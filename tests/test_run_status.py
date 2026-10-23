import json

from fastapi.testclient import TestClient

from backend.app import create_app


def write_metrics(folder, accuracy):
    folder.mkdir(parents=True)
    (folder / 'metrics.json').write_text(
        json.dumps({'architecture': folder.name, 'accuracy': accuracy})
    )


def test_malformed_status_keeps_health_available_and_hides_metrics(tmp_path):
    folder = tmp_path / 'cnn'
    write_metrics(folder, .99)
    (folder / 'run-status.json').write_text('{"state":')

    with TestClient(create_app(tmp_path)) as client:
        health = client.get('/api/health')
        assert health.status_code == 200
        assert health.json()['invalid_runs'] == ['cnn']
        assert client.get('/api/metrics').json()['experiments'] == []


def test_non_object_status_is_untrusted(tmp_path):
    folder = tmp_path / 'vgg16'
    write_metrics(folder, .95)
    (folder / 'run-status.json').write_text('[]')

    with TestClient(create_app(tmp_path)) as client:
        assert client.get('/api/health').json()['invalid_runs'] == ['vgg16']
        assert client.get('/api/metrics').json()['experiments'] == []


def test_valid_states_keep_existing_health_and_metrics_behavior(tmp_path):
    for architecture, state in [
        ('cnn', 'training'),
        ('vgg16', 'failed'),
    ]:
        folder = tmp_path / architecture
        write_metrics(folder, .8)
        (folder / 'run-status.json').write_text(json.dumps({'state': state}))

    with TestClient(create_app(tmp_path)) as client:
        health = client.get('/api/health').json()
        assert health['training'] == ['cnn']
        assert health['failed_runs'] == ['vgg16']
        assert health['invalid_runs'] == []
        assert client.get('/api/metrics').json()['experiments'] == []

        (tmp_path / 'cnn' / 'run-status.json').write_text(
            json.dumps({'state': 'complete'})
        )
        experiments = client.get('/api/metrics').json()['experiments']
        assert experiments == [{'architecture': 'cnn', 'accuracy': .8}]
