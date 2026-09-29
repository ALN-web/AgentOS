"""Tool registry: which real tools exist in this build.

Priority 2 (#6) registers real Google tools here. Until then the set is empty,
so nothing in AgentOS can claim to act on a real app.
"""

_REGISTERED: set[str] = set()


def register_tool(name: str) -> None:
    _REGISTERED.add(name)


def unregister_tool(name: str) -> None:
    _REGISTERED.discard(name)


def registered_tools() -> frozenset[str]:
    return frozenset(_REGISTERED)
