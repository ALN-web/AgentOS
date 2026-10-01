"""User preferences (#18). The JSON shape matches the frontend's
src/store/preferences.js (camelCase), so the Settings page can save it as-is.
snake_case field names are accepted too."""

import re
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

DAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class _Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra="ignore")


class WorkingHours(_Camel):
    start: str = "09:00"
    end: str = "18:00"

    @model_validator(mode="after")
    def _valid(self):
        if not HHMM.match(self.start) or not HHMM.match(self.end):
            raise ValueError("working hours must be HH:MM")
        if self.start >= self.end:
            raise ValueError("working hours must start before they end")
        return self


class ContactGroup(_Camel):
    name: str = Field(min_length=1, max_length=60)
    emails: list[str] = Field(min_length=1, max_length=50)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        v = " ".join(v.split())
        if not v:
            raise ValueError("group name must not be empty")
        return v

    @field_validator("emails")
    @classmethod
    def _emails(cls, v: list[str]) -> list[str]:
        out: list[str] = []
        for e in v:
            e = e.strip().lower()
            if not EMAIL.match(e) or len(e) > 254:
                raise ValueError(f"invalid email address: {e!r}")
            if e not in out:
                out.append(e)
        return out


class Preferences(_Camel):
    timezone: str = "UTC"
    working_days: list[str] = Field(default_factory=lambda: list(DAYS[:5]), min_length=1, max_length=7)
    working_hours: WorkingHours = Field(default_factory=WorkingHours)
    display_name: str = Field(default="", max_length=80)
    signature: str = Field(default="", max_length=500)
    tone: Literal["Friendly", "Formal"] = "Friendly"
    meeting_length: int = Field(default=30, ge=5, le=480)
    groups: list[ContactGroup] = Field(default_factory=list, max_length=20)
    onboarding_dismissed: bool = False

    @field_validator("timezone")
    @classmethod
    def _tz(cls, v: str) -> str:
        try:
            ZoneInfo(v)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError(f"unknown timezone {v!r}; use an IANA name such as 'Asia/Kolkata'") from None
        return v

    @field_validator("working_days")
    @classmethod
    def _days(cls, v: list[str]) -> list[str]:
        unknown = [d for d in v if d not in DAYS]
        if unknown:
            raise ValueError(f"unknown working day(s): {unknown}")
        return [d for d in DAYS if d in set(v)]  # canonical order, no duplicates

    @field_validator("groups")
    @classmethod
    def _unique_groups(cls, v: list[ContactGroup]) -> list[ContactGroup]:
        names = [g.name.lower() for g in v]
        if len(names) != len(set(names)):
            raise ValueError("group names must be unique")
        return v

    def as_client(self) -> dict:
        """The frontend's camelCase shape."""
        return self.model_dump(by_alias=True)
