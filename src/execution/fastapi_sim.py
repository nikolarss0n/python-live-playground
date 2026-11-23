"""In-browser FastAPI simulation for Python Live.

Frozen teaching subset so learner code can say ``from fastapi import FastAPI``.
There is no uvicorn, no listening port, and no PyPI FastAPI. Routes register
when the app is defined; handlers run only when ``dispatch`` is called.

Scope policy: keep this subset bounded rather than chasing full FastAPI or
Pydantic v2 parity. Unsupported APIs should fail clearly with
``SimFastAPIError``, and ``npm run verify:fastapi-parity`` serves as a
regression guard for the supported subset.
"""

from __future__ import annotations

import copy
import enum
import inspect
import json
import math
import re
import sys
import traceback
import types
from typing import Annotated, Any, Callable, Literal, Union, get_args, get_origin, get_type_hints

# {item_id}, or with a Starlette converter: {file_path:path} also matches slashes.
_PATH_PARAM = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)(?::([a-zA-Z]+))?\}")
_CONVERTERS = {"path": ".+", "int": "[0-9]+", "float": r"[0-9]+(?:\.[0-9]+)?"}


def _path_regex(path: str) -> "re.Pattern[str]":
    """The pattern a route's path matches; everything outside {parameters} is literal text."""
    pieces, at = [], 0
    for found in _PATH_PARAM.finditer(path):
        pieces.append(re.escape(path[at:found.start()]))
        pieces.append(f"(?P<{found.group(1)}>{_CONVERTERS.get(found.group(2) or '', '[^/]+')})")
        at = found.end()
    return re.compile("^" + "".join(pieces) + re.escape(path[at:]) + "$")
_DOCS_PATHS = frozenset(
    {"/docs", "/redoc", "/openapi.json", "/docs/oauth2-redirect"}
)
_APPS: list[Any] = []


class SimFastAPIError(RuntimeError):
    """Raised for FastAPI APIs this simulator does not implement."""


class HTTPException(Exception):
    def __init__(self, status_code: int, detail: Any = None) -> None:
        self.status_code = int(status_code)
        self.detail = "Error" if detail is None else detail
        super().__init__(str(self.detail))


class ValidationError(Exception):
    def __init__(self, detail: Any) -> None:
        self.detail = detail
        super().__init__(str(detail))


def _error_list(error: ValidationError) -> list[dict[str, Any]]:
    detail = error.detail.get("detail") if isinstance(error.detail, dict) else None
    return [each for each in detail or [] if isinstance(each, dict) and isinstance(each.get("loc"), list)]


_LIMIT_KEYS = ("gt", "ge", "lt", "le", "min_length", "max_length")


def _limits(kwargs: dict[str, Any]) -> dict[str, Any]:
    return {key: kwargs[key] for key in _LIMIT_KEYS if kwargs.get(key) is not None}


def _check_limits(value: Any, limits: dict[str, Any], loc: list[Any]) -> None:
    """Pydantic-style number and length limits; raises a 422-shaped ValidationError."""
    for key, bound in limits.items():
        if key in ("min_length", "max_length"):
            size = len(value)
            noun = "String" if isinstance(value, str) else "List"
            unit = ("character" if isinstance(value, str) else "item") + ("" if bound == 1 else "s")
            if key == "min_length" and size < bound:
                msg, kind = f"{noun} should have at least {bound} {unit}", f"{noun.lower()}_too_short"
            elif key == "max_length" and size > bound:
                msg, kind = f"{noun} should have at most {bound} {unit}", f"{noun.lower()}_too_long"
            else:
                continue
        else:
            checks = {
                "gt": (value > bound, "greater than", "greater_than"),
                "ge": (value >= bound, "greater than or equal to", "greater_than_equal"),
                "lt": (value < bound, "less than", "less_than"),
                "le": (value <= bound, "less than or equal to", "less_than_equal"),
            }
            ok, words, kind = checks[key]
            if ok:
                continue
            msg = f"Input should be {words} {bound}"
        raise ValidationError({"detail": [{"loc": loc, "msg": msg, "type": kind}]})


class QueryInfo:
    def __init__(self, default: Any = ..., *, alias: str | None = None, limits: dict[str, Any] | None = None) -> None:
        self.default = default
        self.alias = alias
        self.limits = limits or {}


class HeaderInfo:
    def __init__(
        self,
        default: Any = ...,
        *,
        alias: str | None = None,
        convert_underscores: bool = True,
    ) -> None:
        self.default = default
        self.alias = alias
        self.convert_underscores = convert_underscores


def Query(default: Any = ..., **kwargs: Any) -> QueryInfo:
    extra = set(kwargs) - {
        "alias",
        "description",
        "example",
        "title",
        "gt",
        "ge",
        "lt",
        "le",
        "min_length",
        "max_length",
    }
    if extra:
        raise SimFastAPIError(
            f"simulated FastAPI Query() does not support {sorted(extra)}"
        )
    return QueryInfo(default, alias=kwargs.get("alias"), limits=_limits(kwargs))


def Path(default: Any = ..., **kwargs: Any) -> QueryInfo:
    return QueryInfo(default, alias=kwargs.get("alias"), limits=_limits(kwargs))


class DependsInfo:
    def __init__(self, dependency: Any = None, *, use_cache: bool = True) -> None:
        self.dependency = dependency
        self.use_cache = use_cache


def Depends(dependency: Any = None, *, use_cache: bool = True) -> Any:
    """Marks a parameter whose value comes from calling ``dependency`` once per request."""
    return DependsInfo(dependency, use_cache=use_cache)


def Header(default: Any = ..., **kwargs: Any) -> HeaderInfo:
    extra = set(kwargs) - {
        "alias",
        "description",
        "example",
        "title",
        "convert_underscores",
    }
    if extra:
        raise SimFastAPIError(
            f"simulated FastAPI Header() does not support {sorted(extra)}"
        )
    return HeaderInfo(
        default,
        alias=kwargs.get("alias"),
        convert_underscores=kwargs.get("convert_underscores", True),
    )


def Cookie(*_args: Any, **_kwargs: Any) -> Any:
    raise SimFastAPIError("simulated FastAPI has no Cookie")


def File(*_args: Any, **_kwargs: Any) -> Any:
    raise SimFastAPIError("simulated FastAPI has no file uploads")


def Form(*_args: Any, **_kwargs: Any) -> Any:
    raise SimFastAPIError("simulated FastAPI has no form data")


def Body(*_args: Any, **_kwargs: Any) -> Any:
    raise SimFastAPIError(
        "simulated FastAPI has no Body() — use a BaseModel parameter"
    )


class _Headers(dict):
    """Request headers: names match whatever their capitals, as HTTP header names do."""

    def __init__(self, headers: dict[str, Any] | None = None) -> None:
        super().__init__({str(key).lower(): str(value) for key, value in (headers or {}).items()})

    def __getitem__(self, key: str) -> str:
        return super().__getitem__(str(key).lower())

    def __contains__(self, key: object) -> bool:
        return super().__contains__(str(key).lower())

    def get(self, key: str, default: Any = None) -> Any:
        return super().get(str(key).lower(), default)


class _URL:
    def __init__(self, path: str, query: dict[str, Any]) -> None:
        self.path = path
        self.query = "&".join(f"{key}={value}" for key, value in query.items())
        self.scheme, self.hostname, self.port = "http", "testserver", None

    def __str__(self) -> str:
        return f"http://testserver{self.path}" + (f"?{self.query}" if self.query else "")

    __repr__ = __str__


class Request:
    """The incoming request as a handler reads it: method, url, headers, query and path parameters, and the body."""

    def __init__(
        self,
        method: str = "GET",
        path: str = "/",
        query: dict[str, Any] | None = None,
        headers: dict[str, Any] | None = None,
        path_params: dict[str, Any] | None = None,
        body: Any = None,
        app: Any = None,
    ) -> None:
        self.method = method
        self.query_params = {str(key): str(value) for key, value in (query or {}).items()}
        self.url = _URL(path, self.query_params)
        self.headers = _Headers(headers)
        self.path_params = dict(path_params or {})
        self.cookies: dict[str, str] = {}
        self.client = types.SimpleNamespace(host="testclient", port=50000)
        self.state = types.SimpleNamespace()
        self.app = app
        self._body = body

    async def json(self) -> Any:
        if self._body is None or (isinstance(self._body, (str, bytes, bytearray)) and not self._body.strip()):
            raise json.JSONDecodeError("Expecting value", "", 0)
        if isinstance(self._body, (str, bytes, bytearray)):
            return json.loads(self._body)
        return self._body

    async def body(self) -> bytes:
        if self._body is None:
            return b""
        if isinstance(self._body, (bytes, bytearray)):
            return bytes(self._body)
        return (self._body if isinstance(self._body, str) else json.dumps(self._body, separators=(",", ":"))).encode("utf-8")


class _MiddlewareDenied:
    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        raise SimFastAPIError("simulated FastAPI has no middleware")


class status:
    HTTP_200_OK = 200
    HTTP_201_CREATED = 201
    HTTP_204_NO_CONTENT = 204
    HTTP_400_BAD_REQUEST = 400
    HTTP_401_UNAUTHORIZED = 401
    HTTP_403_FORBIDDEN = 403
    HTTP_404_NOT_FOUND = 404
    HTTP_405_METHOD_NOT_ALLOWED = 405
    HTTP_422_UNPROCESSABLE_ENTITY = 422
    HTTP_500_INTERNAL_SERVER_ERROR = 500


class FieldInfo:
    def __init__(self, default: Any, limits: dict[str, Any], factory: Any = None) -> None:
        self._default = default
        self.limits = limits
        self.factory = factory

    @property
    def default(self) -> Any:
        """The declared default; with default_factory, a new one each time it is asked for."""
        return self.factory() if self.factory else self._default


def Field(default: Any = ..., **kwargs: Any) -> Any:
    limits = _limits(kwargs)
    factory = kwargs.get("default_factory")
    return FieldInfo(default, limits, factory) if limits or callable(factory) else default


def _annotations(cls: type) -> dict[str, Any]:
    raw: dict[str, Any] = {}
    for base in reversed(cls.__mro__):
        raw.update(getattr(base, "__annotations__", {}) or {})
    return {k: v for k, v in raw.items() if k != "return"}


_MODEL_HINTS: dict[type, dict[str, Any]] = {}


def _model_hints(cls: type) -> dict[str, Any]:
    """A model's field types, with names written as text resolved in the file that defined the model."""
    if cls in _MODEL_HINTS:
        return _MODEL_HINTS[cls]
    raw = _annotations(cls)
    try:
        resolved = get_type_hints(cls, globalns=getattr(cls, "_plp_globals", None))
    except Exception:
        return raw
    _MODEL_HINTS[cls] = {name: resolved.get(name, hint) for name, hint in raw.items()}
    return _MODEL_HINTS[cls]


def _unwrap_optional(hint: Any) -> tuple[Any, bool]:
    origin = get_origin(hint)
    if origin is Union or origin is getattr(types, "UnionType", Union):
        args = [a for a in get_args(hint) if a is not type(None)]
        if len(args) < len(get_args(hint)):
            return (args[0] if len(args) == 1 else Union[tuple(args)]), True
    return hint, False


def _is_union(hint: Any) -> bool:
    return get_origin(hint) is Union or get_origin(hint) is getattr(types, "UnionType", Union)


def _is_model_list(hint: Any) -> bool:
    return get_origin(hint) is list and _is_model((get_args(hint) or [None])[0])


_BUILTIN_HINTS = {"int": int, "str": str, "float": float, "bool": bool, "Any": Any}


def _one_of(choices: list[Any]) -> str:
    """'a', 'b' or 'c', as pydantic lists the values an Enum or Literal accepts."""
    shown = [repr(choice) for choice in choices]
    return shown[0] if len(shown) == 1 else ", ".join(shown[:-1]) + " or " + shown[-1]


def _coerce(value: Any, hint: Any, strict: bool = False) -> Any:
    """The value as the hinted type. ``strict`` is for JSON bodies, where a number is not text; query, path and
    header values always arrive as text, and code that calls a route may pass them as numbers."""
    hint, optional = _unwrap_optional(hint)
    if isinstance(hint, str):
        hint = _BUILTIN_HINTS.get(hint, hint)
    if value is None:
        if optional:
            return None
        raise ValueError("value is required")
    if hint is inspect._empty or hint is Any or hint is None:
        return value
    if isinstance(hint, str):
        return value
    if _is_union(hint):
        # The member whose type the value already has wins; otherwise the first that accepts it.
        choices = get_args(hint)
        if any(type(value) is choice for choice in choices):
            return value
        for choice in choices:
            try:
                return _coerce(value, choice, strict)
            except (TypeError, ValueError, ValidationError):
                continue
        raise ValueError("Input should be " + " or ".join(getattr(choice, "__name__", str(choice)) for choice in choices))
    if hint is bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            lowered = value.strip().lower()
            if lowered in ("1", "true", "yes", "on"):
                return True
            if lowered in ("0", "false", "no", "off"):
                return False
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return bool(value)
        raise ValueError("expected bool")
    if hint is int:
        if isinstance(value, float) and not value.is_integer():
            raise ValueError("Input should be a valid integer, got a number with a fractional part")
        try:
            return int(value)
        except (TypeError, ValueError, OverflowError):
            raise ValueError("Input should be a valid integer") from None
    if hint is float:
        try:
            return float(value)
        except (TypeError, ValueError):
            raise ValueError("Input should be a valid number") from None
    if hint is str:
        if isinstance(value, str):
            return value
        if strict:
            raise ValueError("Input should be a valid string")
        return str(value)
    if isinstance(hint, type) and issubclass(hint, BaseModel):
        if isinstance(value, hint):
            return value
        if not isinstance(value, dict):
            raise ValueError("Input should be an object")
        return hint(**value)
    if isinstance(hint, type) and issubclass(hint, enum.Enum):
        if isinstance(value, hint):
            return value
        try:
            return hint(value)
        except ValueError:
            raise ValueError("Input should be " + _one_of([member.value for member in hint])) from None
    if isinstance(hint, type) and hasattr(hint, "fromisoformat"):
        if isinstance(value, hint):
            return value
        if isinstance(value, (int, float)) and not isinstance(value, bool) and hint.__name__ in ("date", "datetime"):
            # A number is a Unix timestamp; for a date it must fall exactly on midnight.
            import datetime as _datetime

            moment = _datetime.datetime.fromtimestamp(value, _datetime.timezone.utc)
            if hint.__name__ == "datetime":
                return moment
            if moment.time() == _datetime.time(0):
                return moment.date()
            raise ValueError("Input should be a valid date, like 2026-01-15")
        try:
            return hint.fromisoformat(value)
        except (TypeError, ValueError):
            raise ValueError(f"Input should be a valid {hint.__name__}, like {_NAMED_SAMPLES.get(hint.__name__, 'ISO text')}") from None
    origin = get_origin(hint)
    if origin is Literal:
        if value not in get_args(hint):
            raise ValueError("Input should be " + _one_of(list(get_args(hint))))
        return value
    kind = origin or hint
    if kind in (list, tuple, set, frozenset):
        if not isinstance(value, (list, tuple, set, frozenset)):
            raise ValueError("Input should be a valid list")
        args = get_args(hint)
        fixed = kind is tuple and bool(args) and ... not in args
        if fixed and len(value) > len(args):
            raise ValueError(f"Tuple should have at most {len(args)} items")
        # Each bad item is reported at its index; the caller puts the field's own place in front.
        errors: list[dict[str, Any]] = []
        items = []
        for index, item in enumerate(value):
            try:
                items.append(_coerce(item, (args[index] if fixed else args[0]) if args else Any, strict))
            except ValidationError as exc:
                errors.extend({**each, "loc": ["body", index, *each["loc"][1:]]} for each in _error_list(exc))
            except (TypeError, ValueError) as exc:
                errors.append({"loc": ["body", index], "msg": str(exc), "type": "type_error"})
        if fixed:
            errors.extend({"loc": ["body", index], "msg": "field required", "type": "missing"} for index in range(len(value), len(args)))
        if errors:
            raise ValidationError({"detail": errors})
        try:
            return items if kind is list else kind(items)
        except TypeError:
            raise ValueError("Set items should be text, numbers or other simple values") from None
    if kind is dict:
        if not isinstance(value, dict):
            raise ValueError("Input should be a valid dictionary")
        args = get_args(hint)
        if len(args) != 2:
            return value
        errors = []
        result = {}
        for key, item in value.items():
            try:
                result[_coerce(key, args[0])] = _coerce(item, args[1], strict)
            except ValidationError as exc:
                errors.extend({**each, "loc": ["body", key, *each["loc"][1:]]} for each in _error_list(exc))
            except (TypeError, ValueError) as exc:
                errors.append({"loc": ["body", key], "msg": str(exc), "type": "type_error"})
        if errors:
            raise ValidationError({"detail": errors})
        return result
    return value


def _body_value(parsed_body: Any, hint: Any) -> Any:
    """A whole JSON body that is a dict or a list of models, or a 422 that says where it is wrong."""
    if parsed_body is None:
        raise ValidationError({"detail": [{"loc": ["body"], "msg": "field required", "type": "missing"}]})
    try:
        return _coerce(parsed_body, hint, strict=True)
    except (TypeError, ValueError) as exc:
        raise ValidationError({"detail": [{"loc": ["body"], "msg": str(exc), "type": "type_error"}]}) from exc


def _param_value(given: Any, hint: Any, loc: list[Any], limits: dict[str, Any] | None = None) -> Any:
    """A path, query or header value as its hinted type and inside its limits, or a 422 that names it."""
    try:
        value = _coerce(given, hint if hint is not inspect._empty else str)
    except ValidationError as exc:
        raise ValidationError({"detail": [{**each, "loc": [*loc, *each["loc"][1:]]} for each in _error_list(exc)]}) from None
    except (TypeError, ValueError) as exc:
        raise ValidationError({"detail": [{"loc": loc, "msg": str(exc), "type": "type_error"}]}) from exc
    if limits:
        _check_limits(value, limits, loc)
    return value


class BaseModel:
    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        try:
            cls._plp_globals = sys._getframe(1).f_globals
        except Exception:
            pass

    def __init__(self, **data: Any) -> None:
        hints = _model_hints(type(self))
        values: dict[str, Any] = {}
        # Every field is checked before anything is raised, so one response lists all that is wrong.
        errors: list[dict[str, Any]] = []
        for name, hint in hints.items():
            declared = getattr(type(self), name, ...)
            info = declared if isinstance(declared, FieldInfo) else None
            if name in data:
                try:
                    values[name] = _coerce(data[name], hint, strict=True)
                except ValidationError as exc:
                    # A nested model's errors, placed under this field.
                    errors.extend({**each, "loc": ["body", name, *each["loc"][1:]]} for each in _error_list(exc))
                    continue
                except (TypeError, ValueError) as exc:
                    errors.append({"loc": ["body", name], "msg": str(exc), "type": "type_error"})
                    continue
                if info and values[name] is not None:
                    try:
                        _check_limits(values[name], info.limits, ["body", name])
                    except ValidationError as exc:
                        errors.extend(_error_list(exc))
                continue
            default = (info.default if info else declared) if hasattr(type(self), name) else ...
            if default is ...:
                errors.append({"loc": ["body", name], "msg": "field required", "type": "missing"})
                continue
            values[name] = default if (info and info.factory) else copy.deepcopy(default)
        if errors:
            raise ValidationError({"detail": errors})
        for key, value in values.items():
            object.__setattr__(self, key, value)

    def model_dump(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in _annotations(type(self))}

    def dict(self) -> dict[str, Any]:
        return self.model_dump()

    def __repr__(self) -> str:
        inner = ", ".join(
            f"{name}={getattr(self, name)!r}"
            for name in _annotations(type(self))
        )
        return f"{type(self).__name__}({inner})"


class Route:
    def __init__(
        self,
        method: str,
        path: str,
        handler: Callable[..., Any],
        status_code: int = 200,
        response_model: Any = None,
        dependencies: list[Any] | None = None,
    ) -> None:
        self.method = method.upper()
        self.path = path if path.startswith("/") else f"/{path}"
        self.handler = handler
        self.status_code = int(status_code)
        self.response_model = response_model
        self.dependencies = list(dependencies or [])
        self.regex = _path_regex(self.path)

    def with_prefix(self, prefix: str, dependencies: list[Any]) -> "Route":
        return Route(self.method, prefix + self.path, self.handler, self.status_code,
                     self.response_model, [*dependencies, *self.dependencies])

    def match(self, method: str, path: str) -> dict[str, str] | None:
        if method.upper() != self.method:
            return None
        found = self.regex.match(path)
        if not found:
            return None
        return found.groupdict()

    def as_dict(self, overrides: dict[Any, Any] | None = None) -> dict[str, Any]:
        described: dict[str, Any] = {
            "method": self.method,
            "path": self.path,
            "callPath": _PATH_PARAM.sub("1", self.path),
        }
        name = getattr(self.handler, "__name__", None)
        if isinstance(name, str) and name.isidentifier():
            described["name"] = name
        try:
            described.update(_prepared_request(self, overrides or {}))
        except Exception:
            # A route stays callable when its signature cannot be read; the request just starts blank.
            pass
        return described


class _RouteTable:
    """Route decorators shared by FastAPI and APIRouter."""

    prefix = ""
    routes: list[Route]
    dependencies: list[Any]

    def get(self, path: str, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._decorate("GET", path, kwargs)

    def post(self, path: str, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._decorate("POST", path, kwargs)

    def put(self, path: str, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._decorate("PUT", path, kwargs)

    def delete(self, path: str, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._decorate("DELETE", path, kwargs)

    def patch(self, path: str, **kwargs: Any) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        return self._decorate("PATCH", path, kwargs)

    def include_router(self, router: "APIRouter", *, prefix: str = "", dependencies: Any = None, **_kwargs: Any) -> None:
        for route in router.routes:
            self.routes.append(route.with_prefix(self.prefix + prefix, [*self.dependencies, *(dependencies or [])]))

    def _decorate(
        self, method: str, path: str, kwargs: dict[str, Any]
    ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        def wrap(fn: Callable[..., Any]) -> Callable[..., Any]:
            self.routes.append(
                Route(
                    method,
                    self.prefix + (path if path.startswith("/") else f"/{path}"),
                    fn,
                    status_code=int(kwargs.get("status_code", 200)),
                    response_model=kwargs.get("response_model"),
                    dependencies=[*self.dependencies, *(kwargs.get("dependencies") or [])],
                )
            )
            return fn

        return wrap


class APIRouter(_RouteTable):
    def __init__(self, *, prefix: str = "", dependencies: Any = None, **_kwargs: Any) -> None:
        self.prefix = prefix.rstrip("/")
        self.routes = []
        self.dependencies = list(dependencies or [])


class FastAPI(_RouteTable):
    def __init__(self, *_args: Any, **kwargs: Any) -> None:
        self.routes = []
        self.dependencies = list(kwargs.get("dependencies") or [])
        self.dependency_overrides: dict[Any, Any] = {}
        self.title = kwargs.get("title") or "FastAPI"
        _APPS.append(self)

    def websocket(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SimFastAPIError("simulated FastAPI has no WebSockets")

    def add_middleware(self, *_args: Any, **_kwargs: Any) -> None:
        raise SimFastAPIError("simulated FastAPI has no middleware")

    def middleware(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SimFastAPIError("simulated FastAPI has no middleware")

    def on_event(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SimFastAPIError("simulated FastAPI has no lifecycle events")

    def openapi(self) -> Any:
        raise SimFastAPIError("simulated FastAPI has no /docs or OpenAPI")


def reset() -> None:
    _APPS.clear()


def list_apps() -> list[Any]:
    return list(_APPS)


def list_routes() -> list[dict[str, Any]]:
    if not _APPS:
        return []
    overrides = getattr(_APPS[-1], "dependency_overrides", None)
    # A later route with the same method and path can never be reached, so it is not listed.
    first: dict[tuple[str, str], Route] = {}
    for route in _APPS[-1].routes:
        first.setdefault((route.method, route.path), route)
    return [route.as_dict(overrides) for route in first.values()]


def _jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return _jsonable(value.model_dump())
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        return [_jsonable(item) for item in value]
    if isinstance(value, enum.Enum):
        return _jsonable(value.value)
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    if callable(getattr(value, "isoformat", None)):
        text = value.isoformat()
        return text[:-6] + "Z" if text.endswith("+00:00") else text
    if type(value).__name__ in ("UUID", "Decimal"):
        return str(value)
    return repr(value)


def _apply_response_model(payload: Any, model: Any) -> Any:
    """response_model keeps only the model's fields, so a password in the returned dict never leaves the API."""
    if model is None:
        return payload
    if get_origin(model) is list and get_args(model):
        return [_apply_response_model(item, get_args(model)[0]) for item in payload]
    if not _is_model(model):
        return payload
    data = payload.model_dump() if isinstance(payload, BaseModel) else dict(payload)
    fields = _annotations(model)
    return model(**{key: value for key, value in data.items() if key in fields}).model_dump()


def _is_model(hint: Any) -> bool:
    try:
        return isinstance(hint, type) and issubclass(hint, BaseModel)
    except TypeError:
        return False


def _hint_target(fn: Any) -> Any:
    """A class dependency is called through its __init__, so read hints from there."""
    return fn.__init__ if inspect.isclass(fn) else fn


def _fn_hints(fn: Callable[..., Any]) -> dict[str, Any]:
    target = _hint_target(fn)
    try:
        return dict(get_type_hints(target, include_extras=True))
    except Exception:
        return dict(getattr(target, "__annotations__", {}) or {})


def _resolve_hint(hint: Any, fn: Callable[..., Any]) -> Any:
    if not isinstance(hint, str):
        return hint
    module_globals = getattr(_hint_target(fn), "__globals__", {})
    if hint in module_globals:
        return module_globals[hint]
    builtins_ns = module_globals.get("__builtins__", __builtins__)
    if isinstance(builtins_ns, dict):
        return builtins_ns.get(hint, hint)
    return getattr(builtins_ns, hint, hint)


def _headers_ci(headers: dict[str, Any] | None) -> dict[str, Any]:
    if not headers:
        return {}
    return {str(key).lower(): value for key, value in headers.items()}


def _header_lookup_key(name: str, info: HeaderInfo) -> str:
    if info.alias:
        return str(info.alias).lower()
    key = name
    if info.convert_underscores:
        key = name.replace("_", "-")
    return key.lower()


_SAMPLES: dict[Any, Any] = {str: "string", int: 1, float: 1.5, bool: True}
# Types the simulator passes through as text, sampled in the form FastAPI's JSON uses.
_NAMED_SAMPLES = {
    "date": "2026-01-15",
    "datetime": "2026-01-15T09:30:00",
    "time": "09:30:00",
    "UUID": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "Decimal": 1.5,
}


# Sample values by field name, so a prepared request reads like real data. First match wins.
_NAMED_TEXT = (
    (("email",), "ada@example.com"),
    (("url", "website", "link", "homepage"), "https://example.com"),
    (("phone", "mobile"), "+1 555 0100"),
    (("first_name", "firstname"), "Ada"),
    (("last_name", "lastname", "surname"), "Lovelace"),
    (("username", "user_name", "login", "handle"), "ada"),
    (("password",), "correct-horse-battery"),
    (("title",), "Example title"),
    (("name",), "Example"),
    (("description", "summary", "text", "body", "content", "message", "comment", "note", "notes"), "Some text"),
    (("street", "address"), "1 Main Street"),
    (("city", "town"), "Oslo"),
    (("country",), "Norway"),
    (("zip", "postcode", "postal_code", "zip_code"), "0150"),
    (("currency",), "EUR"),
    (("language", "lang", "locale"), "en"),
    (("color", "colour"), "blue"),
    (("slug",), "example-item"),
    (("created_at", "updated_at", "timestamp"), "2026-01-15T09:30:00"),
    (("date", "day", "birthday"), "2026-01-15"),
)
_NAMED_NUMBERS = (
    (("price", "cost", "amount", "total", "subtotal"), 9.99),
    (("year",), 2026),
    (("age",), 30),
    (("percent", "percentage", "discount"), 10),
    (("latitude", "lat"), 59.91),
    (("longitude", "lon", "lng"), 10.75),
    (("rating", "stars", "score"), 5),
)


def _named(name: str, table: tuple[tuple[tuple[str, ...], Any], ...]) -> Any:
    """The table's value for a field name: priceEUR, unit_price and price all read as price."""
    key = re.sub(r"(?<=[a-z0-9])(?=[A-Z])", "_", name).lower().replace("-", "_")
    for words, value in table:
        for word in words:
            if key == word or key.startswith(word + "_") or key.endswith("_" + word):
                return value
    return None


def _in_range(value: Any, limits: dict[str, Any]) -> Any:
    """A number inside gt/ge/lt/le: the value itself when it fits, else one that does."""
    ge, gt, le, lt = (limits.get(key) for key in ("ge", "gt", "le", "lt"))
    if isinstance(value, int):
        lows = [math.ceil(bound) for bound in (ge,) if bound is not None] + [math.floor(bound) + 1 for bound in (gt,) if bound is not None]
        highs = [math.floor(bound) for bound in (le,) if bound is not None] + [math.ceil(bound) - 1 for bound in (lt,) if bound is not None]
        if lows and value < max(lows):
            value = max(lows)
        if highs and value > min(highs):
            value = min(highs)
        return value
    if all((ge is None or value >= ge, gt is None or value > gt, le is None or value <= le, lt is None or value < lt)):
        return value
    floor = max((bound for bound in (ge, gt) if bound is not None), default=None)
    ceiling = min((bound for bound in (le, lt) if bound is not None), default=None)
    if floor is not None and ceiling is not None:
        return (floor + ceiling) / 2
    if floor is not None:
        return ge if ge == floor else floor + 1
    return le if le == ceiling else ceiling - 1


def _within(value: Any, limits: dict[str, Any]) -> Any:
    """Moves a sample inside the declared limits, so a prepared request passes validation."""
    if isinstance(value, bool) or not limits:
        return value
    if isinstance(value, (int, float)):
        return _in_range(value, limits)
    if isinstance(value, (str, list)):
        shortfall = limits.get("min_length", 0) - len(value)
        if shortfall > 0:
            value = value + "x" * shortfall if isinstance(value, str) else value * limits["min_length"]
        if "max_length" in limits:
            value = value[: limits["max_length"]]
    return value


def _sample(hint: Any, depth: int = 0, name: str = "", limits: dict[str, Any] | None = None) -> Any:
    """A value of the hinted type, as Swagger UI fills an example, or one that suits the field's name."""
    hint, optional = _unwrap_optional(hint)
    if isinstance(hint, str):
        hint = _BUILTIN_HINTS.get(hint, hint)
    origin = get_origin(hint)
    if origin is Union or origin is getattr(types, "UnionType", Union):
        return _sample(next(arg for arg in get_args(hint) if arg is not type(None)), depth, name, limits)
    if origin is Literal:
        return get_args(hint)[0]
    if origin is tuple and get_args(hint) and ... not in get_args(hint):
        return [_sample(arg, depth + 1) for arg in get_args(hint)] if depth < 4 else []
    if origin in (list, tuple, set, frozenset):
        args = [arg for arg in get_args(hint) if arg is not ...]
        return [_sample(args[0], depth + 1)] if args and depth < 4 else []
    if origin is dict or hint is dict:
        return {}
    if hint in (list, tuple, set, frozenset):
        return []
    if _is_model(hint):
        return _sample_model(hint, depth + 1) if depth < 4 else {}
    if isinstance(hint, type) and issubclass(hint, enum.Enum):
        return next((_jsonable(member) for member in hint), None)
    if hint is str:
        # A named value is used as it is or not at all: padding or cutting it would spoil it.
        named = _named(name, _NAMED_TEXT)
        limits = limits or {}
        fits = named and limits.get("min_length", 0) <= len(named) <= limits.get("max_length", len(named))
        return named if fits else "string"
    if hint is int or hint is float:
        named = _named(name, _NAMED_NUMBERS)
        if named is not None and (hint is float or isinstance(named, int)):
            return float(named) if hint is float else named
    if isinstance(hint, type) and hint in _SAMPLES:
        return _SAMPLES[hint]
    if isinstance(hint, type) and hint.__name__ in _NAMED_SAMPLES:
        return _NAMED_SAMPLES[hint.__name__]
    return None if optional else "string"


def _sample_model(model: type, depth: int = 0) -> dict[str, Any]:
    """A JSON body for a model: declared defaults where there are any, typed samples for required fields."""
    body: dict[str, Any] = {}
    for name, hint in _model_hints(model).items():
        declared = getattr(model, name, ...)
        info = declared if isinstance(declared, FieldInfo) else None
        value = info.default if info else declared
        if value is ...:
            value = _sample(hint, depth, name, info.limits if info else None)
        if info and value is not None:
            value = _within(value, info.limits)
        body[name] = _jsonable(value)
    return body


def _field_text(value: Any) -> str:
    """A query, header or path value as typed into the form. A list or dict default is left unsent."""
    value = _jsonable(value)
    if value is None or isinstance(value, (list, dict)):
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value)


def _add_field(fields: list[dict[str, Any]], name: str, hint: Any, default: Any, limits: dict[str, Any]) -> None:
    if any(field["name"] == name for field in fields):
        return
    required = default is inspect._empty or default is ...
    value = default
    if required:
        value = _within(_sample(str if hint is inspect._empty else hint, name=name, limits=limits), limits)
        # One value stands for a list parameter: ?tag=a is a list of one.
        value = value[0] if isinstance(value, list) and value else value
    fields.append({"name": name, "value": _field_text(value), "required": required})


def _path_value(name: str, hint: Any, limits: dict[str, Any]) -> str:
    """What fills {name} in the path: a value of its type, or the name itself for text."""
    hint = _unwrap_optional(hint)[0]
    if hint is inspect._empty or hint is Any:
        return "1"
    if hint is str or hint == "str":
        named = _named(name, _NAMED_TEXT)
        value = named if named and " " not in named else name
    else:
        value = _sample(hint, name=name)
    return _field_text(_within(value, limits)) or "1"


def _describe_params(
    fn: Any, path_names: set[str], overrides: dict[Any, Any], found: dict[str, Any], seen: set[int],
) -> None:
    """Adds what a handler, and every dependency under it, reads from the request. Mirrors ``_call_handler``."""
    if id(fn) in seen or len(seen) > 40:
        return
    seen.add(id(fn))
    hints = _fn_hints(fn)
    for name, param in inspect.signature(fn).parameters.items():
        hint, default = _split_annotated(_resolve_hint(hints.get(name, param.annotation), fn), param.default)
        if isinstance(default, DependsInfo):
            dependency = default.dependency if default.dependency is not None else hint
            if callable(dependency):
                _describe_params(overrides.get(dependency, dependency), path_names, overrides, found, seen)
        elif hint is Request:
            found["reads_request"] = True
        elif _is_model(hint):
            found.setdefault("body", _sample_model(hint))
        elif hint is dict or get_origin(hint) is dict:
            found.setdefault("body", {})
        elif _is_model_list(hint):
            found.setdefault("body", [_sample_model(get_args(hint)[0])])
        elif name in path_names:
            limits = default.limits if isinstance(default, QueryInfo) else {}
            found["path"].setdefault(name, _path_value(name, hint, limits))
        elif isinstance(default, HeaderInfo):
            key = default.alias or (name.replace("_", "-") if default.convert_underscores else name)
            _add_field(found["headers"], str(key), hint, default.default, {})
        elif isinstance(default, QueryInfo):
            _add_field(found["query"], default.alias or name, hint, default.default, default.limits)
        else:
            _add_field(found["query"], name, hint, default, {})


def _prepared_request(route: Route, overrides: dict[Any, Any]) -> dict[str, Any]:
    """The query, headers and JSON body a route reads, ready to send: defaults kept, required values sampled."""
    found: dict[str, Any] = {"query": [], "headers": [], "path": {}}
    seen: set[int] = set()
    converters = dict(_PATH_PARAM.findall(route.path))
    path_names = set(converters)
    for info in route.dependencies:
        if isinstance(info, DependsInfo) and callable(info.dependency):
            _describe_params(overrides.get(info.dependency, info.dependency), path_names, overrides, found, seen)
    _describe_params(route.handler, path_names, overrides, found, seen)
    prepared: dict[str, Any] = {key: found[key] for key in ("query", "headers") if found[key]}
    for name, converter in converters.items():
        if converter == "path" and found["path"].get(name, name) == name:
            # Text that shows what this converter is for: a value with slashes in it.
            found["path"][name] = "folder/file.txt"
    prepared["callPath"] = _PATH_PARAM.sub(lambda match: found["path"].get(match.group(1), "1"), route.path)
    if found.get("reads_request") and route.method.upper() in ("POST", "PUT", "PATCH"):
        # request.json() fails on an empty body, so there is one to send.
        found.setdefault("body", {})
    if "body" in found:
        prepared["body"] = json.dumps(found["body"], indent=2, default=str)
    return prepared


def _parse_body(body: Any) -> Any:
    if isinstance(body, (bytes, bytearray)):
        body = body.decode("utf-8")
    if isinstance(body, str):
        text = body.strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValidationError(
                {
                    "detail": [
                        {
                            "loc": ["body"],
                            "msg": "JSON decode error",
                            "type": "json_invalid",
                        }
                    ]
                }
            ) from exc
    return body


class _RequestScope:
    """One request's dependency cache, cleanups for yield dependencies, and test overrides."""

    def __init__(self, overrides: dict[Any, Any] | None = None, request: Any = None) -> None:
        self.overrides = overrides or {}
        self.cache: dict[Any, Any] = {}
        self.cleanups: list[Any] = []
        self.request = request

    def close(self, failed: bool) -> None:
        while self.cleanups:
            gen = self.cleanups.pop()
            if failed:
                gen.close()
                continue
            try:
                next(gen)
            except StopIteration:
                pass


def _solve_dependency(
    info: DependsInfo,
    hint: Any,
    path_params: dict[str, str],
    query: dict[str, Any] | None,
    body: Any,
    headers: dict[str, Any] | None,
    scope: _RequestScope,
) -> Any:
    dependency = info.dependency if info.dependency is not None else hint
    if not callable(dependency):
        raise SimFastAPIError("Depends() needs a function or class to call")
    dependency = scope.overrides.get(dependency, dependency)
    if info.use_cache and dependency in scope.cache:
        return scope.cache[dependency]
    value = _call_handler(dependency, path_params, query, body, headers, scope)
    if inspect.isgenerator(value):
        scope.cleanups.append(value)
        value = next(value)
    elif inspect.isasyncgen(value):
        raise SimFastAPIError("simulated FastAPI runs yield dependencies written with def, not async def")
    if info.use_cache:
        scope.cache[dependency] = value
    return value


def _split_annotated(hint: Any, default: Any) -> tuple[Any, Any]:
    """Annotated[int, Query(ge=1)] = 5 reads like int = Query(5, ge=1)."""
    if get_origin(hint) is not Annotated:
        return hint, default
    base, *extras = get_args(hint)
    for extra in extras:
        if isinstance(extra, DependsInfo):
            return base, extra
        if isinstance(extra, (QueryInfo, HeaderInfo)):
            if default is not inspect._empty:
                extra = copy.copy(extra)
                extra.default = default
            return base, extra
    return base, default


def _call_handler(
    fn: Callable[..., Any],
    path_params: dict[str, str],
    query: dict[str, Any] | None,
    body: Any,
    headers: dict[str, Any] | None,
    scope: _RequestScope | None = None,
) -> Any:
    scope = scope or _RequestScope()
    hints = _fn_hints(fn)
    query = query or {}
    header_values = _headers_ci(headers)
    kwargs: dict[str, Any] = {}
    parsed_body = _parse_body(body)
    signature = inspect.signature(fn)
    # Every parameter is checked before anything is raised, so one 422 lists all that is wrong.
    errors: list[dict[str, Any]] = []
    for name, param in signature.parameters.items():
        try:
            hint, default = _split_annotated(
                _resolve_hint(hints.get(name, param.annotation), fn),
                param.default,
            )
            if isinstance(default, DependsInfo):
                kwargs[name] = _solve_dependency(default, hint, path_params, query, body, headers, scope)
                continue
            if hint is Request:
                kwargs[name] = scope.request or Request(query=query, headers=headers, path_params=path_params, body=body)
                continue
            if _is_model(hint):
                if parsed_body is None:
                    raise ValidationError(
                        {
                            "detail": [
                                {
                                    "loc": ["body"],
                                    "msg": "field required",
                                    "type": "missing",
                                }
                            ]
                        }
                    )
                if not isinstance(parsed_body, dict):
                    raise ValidationError(
                        {
                            "detail": [
                                {
                                    "loc": ["body"],
                                    "msg": "JSON object required",
                                    "type": "type_error",
                                }
                            ]
                        }
                    )
                kwargs[name] = hint(**parsed_body)
                continue
            if hint is dict or get_origin(hint) is dict or _is_model_list(hint):
                kwargs[name] = _body_value(parsed_body, hint)
                continue
            if name in path_params:
                kwargs[name] = _param_value(path_params[name], hint, ["path", name], default.limits if isinstance(default, QueryInfo) else None)
                continue
            if isinstance(default, HeaderInfo):
                header_key = _header_lookup_key(name, default)
                if header_key in header_values:
                    kwargs[name] = _param_value(header_values[header_key], hint, ["header", header_key])
                    continue
                if default.default is ...:
                    raise ValidationError(
                        {
                            "detail": [
                                {
                                    "loc": ["header", header_key],
                                    "msg": "field required",
                                    "type": "missing",
                                }
                            ]
                        }
                    )
                kwargs[name] = default.default
                continue
            query_key = name
            required = default is inspect._empty
            fallback: Any = inspect._empty
            if isinstance(default, QueryInfo):
                query_key = default.alias or name
                required = default.default is ...
                fallback = default.default
            elif default is not inspect._empty:
                required = False
                fallback = default
            if query_key in query:
                given = query[query_key]
                if get_origin(_unwrap_optional(hint)[0]) is list and not isinstance(given, (list, tuple)):
                    given = [given]
                kwargs[name] = _param_value(given, hint, ["query", query_key], default.limits if isinstance(default, QueryInfo) else None)
                continue
            if required:
                raise ValidationError(
                    {
                        "detail": [
                            {
                                "loc": ["query", query_key],
                                "msg": "field required",
                                "type": "missing",
                            }
                        ]
                    }
                )
            if fallback is not inspect._empty and fallback is not ...:
                kwargs[name] = fallback
        except ValidationError as exc:
            errors.extend(_error_list(exc) or [{"loc": [name], "msg": str(exc.detail), "type": "value_error"}])
    if errors:
        raise ValidationError({"detail": errors})
    return _finish_async(fn(**kwargs))


def _finish_async(result: Any) -> Any:
    """Run an ``async def`` route to its return value, as FastAPI awaits it."""
    if not inspect.iscoroutine(result):
        return result
    import asyncio

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(result)
    # The playground already runs inside an event loop, so step the coroutine here.
    # Plain awaits and asyncio.sleep(0) finish at once; a real wait cannot be paused for.
    try:
        while True:
            if result.send(None) is not None:
                result.close()
                raise SimFastAPIError(
                    "simulated FastAPI cannot pause an async route for a timer or "
                    "task — remove the wait, or use await asyncio.sleep(0)"
                )
    except StopIteration as done:
        return done.value


def _crash_line(exc: BaseException) -> int | None:
    """The line of the learner's file where a handler's exception was raised, when it was raised there."""
    line = None
    for frame in traceback.extract_tb(exc.__traceback__):
        if frame.filename == "<playground>":
            line = frame.lineno
    return line


def _http_result(
    method: str, path: str, status_code: int, body: Any
) -> dict[str, Any]:
    return {
        "method": method.upper(),
        "path": path,
        "status": int(status_code),
        "body": _jsonable(body),
        "simulated": True,
    }


def dispatch(
    app: FastAPI,
    method: str,
    path: str,
    query: dict[str, Any] | None = None,
    body: Any = None,
    headers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    method = (method or "GET").upper()
    raw_path = path or "/"
    if "?" in raw_path:
        raw_path, query_string = raw_path.split("?", 1)
        parsed: dict[str, Any] = dict(query or {})
        for part in query_string.split("&"):
            if not part:
                continue
            if "=" in part:
                key, value = part.split("=", 1)
                parsed[key] = value
            else:
                parsed[part] = ""
        query = parsed
    path = raw_path if raw_path.startswith("/") else f"/{raw_path}"

    if not any(route.regex.match(path) for route in app.routes):
        # /notes and /notes/ reach the same route, as FastAPI's redirect does.
        other = path.rstrip("/") if path.endswith("/") and path != "/" else f"{path}/"
        if any(route.regex.match(other) for route in app.routes):
            path = other

    matched_wrong_method = False
    for route in app.routes:
        params = route.match(method, path)
        if params is not None:
            scope = _RequestScope(
                getattr(app, "dependency_overrides", None),
                Request(method, path, query, headers, params, body, app),
            )
            failed = True
            try:
                for info in route.dependencies:
                    if isinstance(info, DependsInfo):
                        _solve_dependency(info, None, params, query, body, headers, scope)
                payload = _call_handler(
                    route.handler, params, query, body, headers, scope
                )
                status_code = route.status_code
                if (
                    isinstance(payload, tuple)
                    and len(payload) == 2
                    and isinstance(payload[1], int)
                ):
                    payload, status_code = payload
                model = route.response_model
                if model is None:
                    returned = _fn_hints(route.handler).get("return")
                    if _is_model(returned) or (get_origin(returned) is list and _is_model((get_args(returned) or [None])[0])):
                        model = returned
                payload = _apply_response_model(payload, model)
                failed = False
                return _http_result(method, path, status_code, None if status_code == 204 else payload)
            except HTTPException as exc:
                return _http_result(
                    method, path, exc.status_code, {"detail": exc.detail}
                )
            except ValidationError as exc:
                detail = (
                    exc.detail
                    if isinstance(exc.detail, dict)
                    else {"detail": exc.detail}
                )
                return _http_result(method, path, 422, detail)
            except SimFastAPIError:
                raise
            except Exception as exc:
                crashed = _http_result(
                    method,
                    path,
                    500,
                    {"detail": f"{type(exc).__name__}: {exc}"},
                )
                line = _crash_line(exc)
                if line is not None:
                    crashed["line"] = line
                return crashed
            finally:
                scope.close(failed)
        if route.regex.match(path):
            matched_wrong_method = True

    if matched_wrong_method:
        return _http_result(
            method, path, 405, {"detail": "Method Not Allowed"}
        )
    if path in _DOCS_PATHS:
        return _http_result(
            method,
            path,
            404,
            {"detail": "simulated FastAPI has no /docs or OpenAPI"},
        )
    return _http_result(method, path, 404, {"detail": "Not Found"})


def dispatch_last(
    method: str,
    path: str,
    query: dict[str, Any] | None = None,
    body: Any = None,
    headers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if not _APPS:
        return _http_result(
            method,
            path or "/",
            404,
            {"detail": "No FastAPI app was registered"},
        )
    return dispatch(
        _APPS[-1], method, path, query=query, body=body, headers=headers
    )


def _uvicorn_run(*_args: Any, **_kwargs: Any) -> None:
    raise SimFastAPIError(
        "simulated FastAPI does not start uvicorn — send a request from the API tab "
        "or fastapi.testclient.TestClient"
    )


class Response(dict):
    """Dict-shaped TestClient response so print() renders as an HTTP card."""

    def __init__(self, result: dict[str, Any]) -> None:
        payload = {
            "method": result.get("method"),
            "path": result.get("path"),
            "status": result.get("status"),
            "body": result.get("body"),
            "simulated": True,
        }
        super().__init__(payload)
        self.status_code = int(payload["status"] or 0)
        self.headers: dict[str, Any] = {}

    def json(self) -> Any:
        return self.get("body")

    @property
    def text(self) -> str:
        body = self.get("body")
        if isinstance(body, str):
            return body
        return json.dumps(body)


class TestClient:
    def __init__(self, app: FastAPI) -> None:
        self.app = app

    def request(
        self,
        method: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
        headers: dict[str, Any] | None = None,
        **_kwargs: Any,
    ) -> Response:
        return Response(
            dispatch(
                self.app,
                method,
                url,
                query=params,
                body=json,
                headers=headers,
            )
        )

    def get(self, url: str, **kwargs: Any) -> Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> Response:
        return self.request("POST", url, **kwargs)

    def put(self, url: str, **kwargs: Any) -> Response:
        return self.request("PUT", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> Response:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> Response:
        return self.request("DELETE", url, **kwargs)


def install() -> None:
    fastapi = types.ModuleType("fastapi")
    fastapi.FastAPI = FastAPI  # type: ignore[attr-defined]
    fastapi.HTTPException = HTTPException  # type: ignore[attr-defined]
    fastapi.Query = Query  # type: ignore[attr-defined]
    fastapi.Path = Path  # type: ignore[attr-defined]
    fastapi.Depends = Depends  # type: ignore[attr-defined]
    fastapi.Header = Header  # type: ignore[attr-defined]
    fastapi.Cookie = Cookie  # type: ignore[attr-defined]
    fastapi.File = File  # type: ignore[attr-defined]
    fastapi.Form = Form  # type: ignore[attr-defined]
    fastapi.Body = Body  # type: ignore[attr-defined]
    fastapi.Request = Request  # type: ignore[attr-defined]
    fastapi.APIRouter = APIRouter  # type: ignore[attr-defined]
    fastapi.status = status  # type: ignore[attr-defined]
    fastapi.SimFastAPIError = SimFastAPIError  # type: ignore[attr-defined]

    exceptions = types.ModuleType("fastapi.exceptions")
    exceptions.HTTPException = HTTPException  # type: ignore[attr-defined]
    fastapi.exceptions = exceptions  # type: ignore[attr-defined]

    middleware = types.ModuleType("fastapi.middleware")
    cors = types.ModuleType("fastapi.middleware.cors")
    cors.CORSMiddleware = _MiddlewareDenied  # type: ignore[attr-defined]
    middleware.cors = cors  # type: ignore[attr-defined]
    fastapi.middleware = middleware  # type: ignore[attr-defined]

    fastapi.__path__ = []  # type: ignore[attr-defined]
    testclient_mod = types.ModuleType("fastapi.testclient")
    testclient_mod.TestClient = TestClient  # type: ignore[attr-defined]
    fastapi.testclient = testclient_mod  # type: ignore[attr-defined]

    sys.modules["fastapi"] = fastapi
    sys.modules["fastapi.exceptions"] = exceptions
    sys.modules["fastapi.middleware"] = middleware
    sys.modules["fastapi.middleware.cors"] = cors
    sys.modules["fastapi.testclient"] = testclient_mod

    pydantic = types.ModuleType("pydantic")
    pydantic.BaseModel = BaseModel  # type: ignore[attr-defined]
    pydantic.Field = Field  # type: ignore[attr-defined]
    pydantic.ValidationError = ValidationError  # type: ignore[attr-defined]
    sys.modules["pydantic"] = pydantic

    uvicorn = types.ModuleType("uvicorn")
    uvicorn.run = _uvicorn_run  # type: ignore[attr-defined]
    sys.modules["uvicorn"] = uvicorn


def run_source(source: str) -> dict[str, Any]:
    """Execute learner source. Registers routes; does not invoke handlers."""
    install()
    reset()
    namespace = {"__name__": "__main__"}
    # dont_inherit: this file uses postponed annotations; learner source must not.
    compiled = compile(source, "<playground>", "exec", dont_inherit=True)
    exec(compiled, namespace)
    return {"routes": list_routes()}


def run_source_and_dispatch(
    source: str,
    method: str,
    path: str,
    query: dict[str, Any] | None = None,
    body: Any = None,
    headers: dict[str, Any] | None = None,
) -> dict[str, Any]:
    run_source(source)
    result = dispatch_last(
        method, path, query=query, body=body, headers=headers
    )
    result["routes"] = list_routes()
    return result


def _main() -> None:
    req = json.load(sys.stdin)
    op = req.get("op", "dispatch")
    if op == "register":
        payload = run_source(req["source"])
        json.dump(payload, sys.stdout)
        return
    if op == "exec":
        install()
        reset()
        namespace = {"__name__": "__main__"}
        compiled = compile(
            req["source"], "<playground>", "exec", dont_inherit=True
        )
        exec(compiled, namespace)
        export = req.get("export") or "out"
        json.dump(
            {
                "routes": list_routes(),
                "value": _jsonable(namespace.get(export)),
            },
            sys.stdout,
        )
        return
    payload = run_source_and_dispatch(
        req["source"],
        req.get("method") or "GET",
        req.get("path") or "/",
        query=req.get("query"),
        body=req.get("body"),
        headers=req.get("headers"),
    )
    json.dump(payload, sys.stdout)


if __name__ == "__main__":
    _main()
