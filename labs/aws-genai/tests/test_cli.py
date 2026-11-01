from aws_genai_lab import cli


def test_default_cli_never_reads_live_settings_or_creates_aws_client(monkeypatch, capsys):
    def forbidden(*args, **kwargs):
        raise AssertionError("Live settings and clients require an explicit --live flag")

    monkeypatch.setattr(cli.LiveSettings, "from_environment", forbidden)
    monkeypatch.setattr(cli, "live_client", forbidden)
    assert cli.main([]) == 0
    assert '"source": "synthetic-fixture"' in capsys.readouterr().out
