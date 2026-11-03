"""In-browser FastAPI simulation for Python Live.

Syntax-compatible subset so learner code can say ``from fastapi import FastAPI``.
There is no uvicorn, no listening port, and no PyPI FastAPI. Routes register
when the app is defined; handlers run only when ``dispatch`` is called.
"""

from __future__ import annotations

import inspect
import json
import re
import sys
import types
from typing import Any, Callable, Union, get_args, get_origin

_PATH_PARAM = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")
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


class QueryInfo:
    def __init__(self, default: Any = ..., *, alias: str | None = None) -> None:
        self.default = default
        self.alias = alias


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
    }
    if extra:
        raise SimFastAPIError(
            f"simulated FastAPI Query() does not support {sorted(extra)}"
        )
    return QueryInfo(default, alias=kwargs.get("alias"))


def Path(default: Any = ..., **kwargs: Any) -> QueryInfo:
    return QueryInfo(default, alias=kwargs.get("alias"))


def Depends(*_args: Any, **_kwargs: Any) -> Any:
    raise SimFastAPIError(
        "simulated FastAPI has no Depends — keep auth and logic in the handler"
    )


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


class Request:
    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        raise SimFastAPIError(
            "simulated FastAPI has no Request object — use path, query, "
            "and BaseModel parameters"
        )


class APIRouter:
    def __init__(self, *_args: Any, **_kwargs: Any) -> None:
        raise SimFastAPIError("simulated FastAPI has no routers")


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


def Field(default: Any = ..., **_kwargs: Any) -> Any:
    return default


def _annotations(cls: type) -> dict[str, Any]:
    raw: dict[str, Any] = {}
    for base in reversed(cls.__mro__):
        raw.update(getattr(base, "__annotations__", {}) or {})
    return {k: v for k, v in raw.items() if k != "return"}


def _unwrap_optional(hint: Any) -> tuple[Any, bool]:
    origin = get_origin(hint)
    if origin is Union or origin is getattr(types, "UnionType", Union):
        args = [a for a in get_args(hint) if a is not type(None)]
        if len(args) == 1:
            return args[0], True
    return hint, False


_BUILTIN_HINTS = {"int": int, "str": str, "float": float, "bool": bool, "Any": Any}


def _coerce(value: Any, hint: Any) -> Any:
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
        if isinstance(value, bool):
            raise ValueError("expected int")
        return int(value)
    if hint is float:
        if isinstance(value, bool):
            raise ValueError("expected float")
        return float(value)
    if hint is str:
        return value if isinstance(value, str) else str(value)
    if isinstance(hint, type) and issubclass(hint, BaseModel):
        if isinstance(value, hint):
            return value
        if not isinstance(value, dict):
            raise ValueError("expected object")
        return hint(**value)
    origin = get_origin(hint)
    if origin in (list, tuple):
        item_hint = get_args(hint)[0] if get_args(hint) else Any
        if not isinstance(value, (list, tuple)):
            raise ValueError("expected list")
        items = [_coerce(item, item_hint) for item in value]
        return items if origin is list else tuple(items)
    return value


class BaseModel:
    def __init__(self, **data: Any) -> None:
        hints = _annotations(type(self))
        unexpected = [key for key in data if key not in hints]
        if unexpected:
            raise ValidationError(
                {
                    "detail": [
                        {
                            "loc": ["body", key],
                            "msg": "extra field",
                            "type": "extra",
                        }
                        for key in unexpected
                    ]
                }
            )
        values: dict[str, Any] = {}
        for name, hint in hints.items():
            if name in data:
                try:
                    values[name] = _coerce(data[name], hint)
                except (TypeError, ValueError) as exc:
                    raise ValidationError(
                        {
                            "detail": [
                                {
                                    "loc": ["body", name],
                                    "msg": str(exc),
                                    "type": "type_error",
                                }
                            ]
                        }
                    ) from exc
                continue
            if hasattr(type(self), name):
                default = getattr(type(self), name)
                if default is ...:
                    raise ValidationError(
                        {
                            "detail": [
                                {
                                    "loc": ["body", name],
                                    "msg": "field required",
                                    "type": "missing",
                                }
                            ]
                        }
                    )
                values[name] = default
                continue
            raise ValidationError(
                {
                    "detail": [
                        {
                            "loc": ["body", name],
                            "msg": "field required",
                            "type": "missing",
                        }
                    ]
                }
            )
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
    ) -> None:
        self.method = method.upper()
        self.path = path if path.startswith("/") else f"/{path}"
        self.handler = handler
        self.status_code = int(status_code)
        pattern = _PATH_PARAM.sub(r"(?P<\1>[^/]+)", self.path)
        self.regex = re.compile("^" + pattern + "$")

    def match(self, method: str, path: str) -> dict[str, str] | None:
        if method.upper() != self.method:
            return None
        found = self.regex.match(path)
        if not found:
            return None
        return found.groupdict()

    def as_dict(self) -> dict[str, str]:
        return {
            "method": self.method,
            "path": self.path,
            "callPath": _PATH_PARAM.sub("1", self.path),
        }


class FastAPI:
    def __init__(self, *_args: Any, **kwargs: Any) -> None:
        if kwargs.get("dependencies"):
            raise SimFastAPIError("simulated FastAPI has no Depends")
        self.routes: list[Route] = []
        self.title = kwargs.get("title") or "FastAPI"
        _APPS.append(self)

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

    def websocket(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SimFastAPIError("simulated FastAPI has no WebSockets")

    def add_middleware(self, *_args: Any, **_kwargs: Any) -> None:
        raise SimFastAPIError("simulated FastAPI has no middleware")

    def middleware(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SimFastAPIError("simulated FastAPI has no middleware")

    def include_router(self, *_args: Any, **_kwargs: Any) -> None:
        raise SimFastAPIError("simulated FastAPI has no routers")

    def on_event(self, *_args: Any, **_kwargs: Any) -> Any:
        raise SimFastAPIError("simulated FastAPI has no lifecycle events")

    def openapi(self) -> Any:
        raise SimFastAPIError("simulated FastAPI has no /docs or OpenAPI")

    def _decorate(
        self, method: str, path: str, kwargs: dict[str, Any]
    ) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
        if kwargs.get("dependencies"):
            raise SimFastAPIError("simulated FastAPI has no Depends")

        def wrap(fn: Callable[..., Any]) -> Callable[..., Any]:
            status_code = kwargs.get("status_code", 200)
            self.routes.append(
                Route(method, path, fn, status_code=int(status_code))
            )
            return fn

        return wrap


def reset() -> None:
    _APPS.clear()


def list_apps() -> list[Any]:
    return list(_APPS)


def list_routes() -> list[dict[str, str]]:
    if not _APPS:
        return []
    return [route.as_dict() for route in _APPS[-1].routes]


def _jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump()
    if isinstance(value, dict):
        return {str(key): _jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_jsonable(item) for item in value]
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return repr(value)


def _is_model(hint: Any) -> bool:
    try:
        return isinstance(hint, type) and issubclass(hint, BaseModel)
    except TypeError:
        return False


def _fn_hints(fn: Callable[..., Any]) -> dict[str, Any]:
    try:
        return dict(get_type_hints(fn, include_extras=False))
    except Exception:
        return dict(getattr(fn, "__annotations__", {}) or {})


def _resolve_hint(hint: Any, fn: Callable[..., Any]) -> Any:
    if not isinstance(hint, str):
        return hint
    if hint in fn.__globals__:
        return fn.__globals__[hint]
    builtins_ns = fn.__globals__.get("__builtins__", __builtins__)
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


def _call_handler(
    fn: Callable[..., Any],
    path_params: dict[str, str],
    query: dict[str, Any] | None,
    body: Any,
    headers: dict[str, Any] | None,
) -> Any:
    hints = _fn_hints(fn)
    query = query or {}
    header_values = _headers_ci(headers)
    kwargs: dict[str, Any] = {}
    parsed_body = _parse_body(body)
    signature = inspect.signature(fn)
    for name, param in signature.parameters.items():
        hint = _resolve_hint(
            hints.get(name, param.annotation),
            fn,
        )
        if hint is Request or (
            isinstance(hint, type) and hint.__name__ == "Request"
        ):
            raise SimFastAPIError(
                "simulated FastAPI has no Request object — use path, query, "
                "Header, and BaseModel parameters"
            )
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
        if hint is dict or get_origin(hint) is dict:
            if not isinstance(parsed_body, dict):
                raise ValidationError({"detail": [{"loc": ["body"], "msg": "JSON object required", "type": "type_error"}]})
            kwargs[name] = parsed_body
            continue
        if name in path_params:
            try:
                kwargs[name] = _coerce(
                    path_params[name],
                    hint if hint is not inspect._empty else str,
                )
            except (TypeError, ValueError) as exc:
                raise ValidationError(
                    {
                        "detail": [
                            {
                                "loc": ["path", name],
                                "msg": str(exc),
                                "type": "type_error",
                            }
                        ]
                    }
                ) from exc
            continue
        default = param.default
        if isinstance(default, HeaderInfo):
            header_key = _header_lookup_key(name, default)
            if header_key in header_values:
                try:
                    kwargs[name] = _coerce(
                        header_values[header_key],
                        hint if hint is not inspect._empty else str,
                    )
                except (TypeError, ValueError) as exc:
                    raise ValidationError(
                        {
                            "detail": [
                                {
                                    "loc": ["header", name],
                                    "msg": str(exc),
                                    "type": "type_error",
                                }
                            ]
                        }
                    ) from exc
                continue
            if default.default is ...:
                raise ValidationError(
                    {
                        "detail": [
                            {
                                "loc": ["header", name],
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
            try:
                kwargs[name] = _coerce(
                    query[query_key],
                    hint if hint is not inspect._empty else str,
                )
            except (TypeError, ValueError) as exc:
                raise ValidationError(
                    {
                        "detail": [
                            {
                                "loc": ["query", name],
                                "msg": str(exc),
                                "type": "type_error",
                            }
                        ]
                    }
                ) from exc
            continue
        if required:
            raise ValidationError(
                {
                    "detail": [
                        {
                            "loc": ["query", name],
                            "msg": "field required",
                            "type": "missing",
                        }
                    ]
                }
            )
        if fallback is not inspect._empty and fallback is not ...:
            kwargs[name] = fallback
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

    matched_wrong_method = False
    for route in app.routes:
        params = route.match(method, path)
        if params is not None:
            try:
                payload = _call_handler(
                    route.handler, params, query, body, headers
                )
                status_code = route.status_code
                if (
                    isinstance(payload, tuple)
                    and len(payload) == 2
                    and isinstance(payload[1], int)
                ):
                    payload, status_code = payload
                return _http_result(method, path, status_code, payload)
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
                return _http_result(
                    method,
                    path,
                    500,
                    {"detail": f"{type(exc).__name__}: {exc}"},
                )
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
        "simulated FastAPI does not start uvicorn — use Call on a route in Results "
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
