import pytest
from src.app import app, APP_VERSION


@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client


def test_dashboard_renders(client):
    response = client.get('/')
    assert response.status_code == 200
    assert b'DeployWatch' in response.data
    assert b'pipeline' in response.data.lower()


def test_health(client):
    response = client.get('/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'healthy'


def test_info(client):
    response = client.get('/info')
    assert response.status_code == 200
    data = response.get_json()
    assert data['app'] == 'DeployWatch'
    assert data['version'] == APP_VERSION
    assert 'uptime_seconds' in data
    assert isinstance(data['uptime_seconds'], int)


def test_api_status(client):
    response = client.get('/api/status')
    assert response.status_code == 200
    data = response.get_json()
    assert data['app'] == 'DeployWatch'
    assert data['status'] == 'running'
    assert data['version'] == APP_VERSION
    assert data['uptime_seconds'] >= 0


def test_version_is_consistent(client):
    """The version reported by every endpoint must match the single source of truth."""
    status = client.get('/api/status').get_json()
    info = client.get('/info').get_json()
    assert status['version'] == info['version'] == APP_VERSION


def test_not_found_page(client):
    response = client.get('/this-route-does-not-exist')
    assert response.status_code == 404
    assert b'DeployWatch' in response.data

def test_live_release_identity(client):
    info = client.get('/info').get_json()
    status = client.get('/api/status').get_json()
    assert info['release_note'] and status['release_note'] == info['release_note']
    assert status['revision'] == info['revision']
