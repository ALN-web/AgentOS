import pytest
import httpx
from datetime import datetime, timezone

from app.integrations.google import GoogleClient, GoogleError
from app.tools.google import CalendarUpdateEventTool, CalendarGetEventTool, CalendarGetEventInput
from app.tools.base import ToolContext, ToolResult
from app.domain import RiskLevel
from app.db.models import Integration

class MockGoogleConnector:
    def access_token(self, db, integ):
        return "fake-token"

    def http(self):
        class MockHttp:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            
            def request(self, method, url, **kwargs):
                self.method = method
                self.url = url
                self.kwargs = kwargs
                
                class MockRes:
                    def __init__(self, status_code, json_data):
                        self.status_code = status_code
                        self.content = b"fake"
                        self._json_data = json_data
                    def json(self): return self._json_data

                if "timeout" in url:
                    raise httpx.TimeoutException("timeout")
                if "network" in url:
                    raise httpx.HTTPError("network")

                if method == "PATCH":
                    if "401" in url: return MockRes(401, {"error": "invalid_grant"})
                    if "403" in url: return MockRes(403, {})
                    if "429" in url: return MockRes(429, {})
                    if "500" in url: return MockRes(500, {})
                    if "400" in url: return MockRes(400, {})
                    if "404" in url: return MockRes(404, {})
                    
                    return MockRes(200, {
                        "id": "event-123",
                        "summary": kwargs.get("json", {}).get("summary", "Updated Event"),
                        "status": "confirmed",
                        "htmlLink": "https://calendar.google.com/event",
                        "start": kwargs.get("json", {}).get("start", {"dateTime": "2026-10-01T10:00:00Z"}),
                        "end": kwargs.get("json", {}).get("end", {"dateTime": "2026-10-01T11:00:00Z"}),
                    })

                if method == "GET":
                    if "404" in url:
                        return MockRes(404, {})
                    if "cancelled" in url:
                        return MockRes(200, {"id": "event-123", "status": "cancelled"})
                    if "missing" in url:
                        return MockRes(404, {})
                    return MockRes(200, {
                        "id": "event-123",
                        "summary": "Existing Event",
                        "status": "confirmed",
                        "htmlLink": "https://calendar.google.com/event",
                        "start": {"dateTime": "2026-10-01T10:00:00Z", "timeZone": "UTC"},
                        "end": {"dateTime": "2026-10-01T11:00:00Z", "timeZone": "UTC"},
                        "location": "Office",
                        "description": "Weekly meeting",
                        "attendees": [{"email": "test@example.com"}]
                    })

                return MockRes(500, {})

        return MockHttp()

@pytest.fixture
def ctx():
    connector = MockGoogleConnector()
    integ = Integration(user_id=1, provider="google", account_email="test@example.com")
    class MockDB:
        def flush(self): pass
        def commit(self): pass
        
    client = GoogleClient(connector, MockDB(), integ)
    return ToolContext(user_id=1, mission_id="m1", task_id="t1", google=client)

def test_calendar_get_event(ctx):
    tool = CalendarGetEventTool()
    assert tool.risk == RiskLevel.LOW

    res = tool.execute(ctx, {"event_id": "event-123"})
    assert res.status == "success"
    assert res.output["event_id"] == "event-123"
    assert res.output["summary"] == "Existing Event"
    assert res.evidence[0]["type"] == "calendar_event"

def test_calendar_update_event(ctx):
    tool = CalendarUpdateEventTool()
    assert tool.risk == RiskLevel.HIGH

    res = tool.execute(ctx, {
        "event_id": "event-123",
        "patch": {"summary": "Changed Summary"}
    })
    
    assert res.status == "success"
    assert res.output["event_id"] == "event-123"
    assert res.output["summary"] == "Changed Summary"
    assert res.evidence[0]["type"] == "calendar_event"

def test_calendar_patch_validation(ctx):
    tool = CalendarUpdateEventTool()
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "event-123", "patch": {}})
    assert exc.value.error_class == "validation_error"
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "event-123", "patch": {"unsupported_field": "123"}})
    assert exc.value.error_class == "validation_error"

def test_calendar_update_verification(ctx):
    tool = CalendarUpdateEventTool()
    
    # Successful verify summary
    res = ToolResult(
        status="success", tool="calendar.update_event",
        output={"event_id": "event-123", "_patch_body": {"summary": "Existing Event"}}
    )
    v = tool.verify(ctx, res)
    assert v["verified"] is True

    # Failed verify summary
    res = ToolResult(
        status="success", tool="calendar.update_event",
        output={"event_id": "event-123", "_patch_body": {"summary": "Different Summary"}}
    )
    v = tool.verify(ctx, res)
    assert v["verified"] is False
    
    # Successful verify location and description
    res = ToolResult(
        status="success", tool="calendar.update_event",
        output={"event_id": "event-123", "_patch_body": {"location": "Office", "description": "Weekly meeting"}}
    )
    v = tool.verify(ctx, res)
    assert v["verified"] is True
    
    # Successful verify start/end and attendees
    res = ToolResult(
        status="success", tool="calendar.update_event",
        output={"event_id": "event-123", "_patch_body": {
            "start": {"dateTime": "2026-10-01T10:00:00Z", "timeZone": "UTC"},
            "end": {"dateTime": "2026-10-01T11:00:00Z", "timeZone": "UTC"},
            "attendees": [{"email": "test@example.com"}]
        }}
    )
    v = tool.verify(ctx, res)
    assert v["verified"] is True
    
    # Failed verify one of multiple fields
    res = ToolResult(
        status="success", tool="calendar.update_event",
        output={"event_id": "event-123", "_patch_body": {
            "start": {"dateTime": "2026-10-01T10:00:00Z", "timeZone": "UTC"},
            "location": "Wrong Location"
        }}
    )
    v = tool.verify(ctx, res)
    assert v["verified"] is False
    
    # Cancelled event
    res = ToolResult(
        status="success", tool="calendar.update_event",
        output={"event_id": "cancelled", "_patch_body": {"summary": "Different Summary"}}
    )
    v = tool.verify(ctx, res)
    assert v["verified"] is False

def test_calendar_errors(ctx):
    tool = CalendarUpdateEventTool()
    valid_patch = {"summary": "valid"}

    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "401", "patch": valid_patch})
    assert exc.value.error_class == "authentication_failed"

    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "403", "patch": valid_patch})
    assert exc.value.error_class == "permission_denied"

    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "429", "patch": valid_patch})
    assert exc.value.error_class == "rate_limited"

    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "500", "patch": valid_patch})
    assert exc.value.error_class == "service_unavailable"
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "400", "patch": valid_patch})
    assert exc.value.error_class == "validation_error"

    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "timeout", "patch": valid_patch})
    assert exc.value.error_class == "timeout"
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "network", "patch": valid_patch})
    assert exc.value.error_class == "network_error"

def test_calendar_get_404(ctx):
    tool = CalendarGetEventTool()
    
    with pytest.raises(GoogleError) as exc:
        tool.execute(ctx, {"event_id": "404"})
    assert exc.value.error_class == "not_found"

def test_simulated_tools_do_not_fabricate_urls(ctx):
    from app.tools.google import SimulatedCalendarUpdateEventTool, SimulatedCalendarGetEventTool
    
    up_tool = SimulatedCalendarUpdateEventTool()
    up_res = up_tool.execute(ctx, {"event_id": "evt-123", "patch": {"summary": "sim"}})
    assert "html_link" not in up_res.output
    assert up_res.evidence[0].get("url") is None

    get_tool = SimulatedCalendarGetEventTool()
    get_res = get_tool.execute(ctx, {"event_id": "evt-123"})
    assert "html_link" not in get_res.output
    assert get_res.evidence[0].get("url") is None
