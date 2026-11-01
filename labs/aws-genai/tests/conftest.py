import socket

import pytest
from botocore.credentials import CredentialResolver


@pytest.fixture(autouse=True)
def offline_boundary(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError("Default tests must not use network or resolve AWS credentials")

    monkeypatch.setattr(socket.socket, "connect", forbidden)
    monkeypatch.setattr(socket, "create_connection", forbidden)
    monkeypatch.setattr(CredentialResolver, "load_credentials", forbidden)
