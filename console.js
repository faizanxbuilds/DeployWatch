const byId = id => document.getElementById(id);
const apiBase = document.body.dataset.apiBase;
const links = [...document.querySelectorAll('[data-view]')];

function navigate() {
  const active = links.find(link => link.hash === location.hash) || links[0];
  for (const link of links) {
    byId(link.dataset.view).hidden = link !== active;
    if (link === active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  byId('crumb').textContent = active.textContent;
  document.title = active.textContent + ' | DeployWatch';
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);
navigate();

let successes = 0;
let checks = 0;
let startedAt = null;
function showUptime() {
  if (startedAt === null) return;
  const seconds = Math.floor((performance.now() - startedAt) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  byId('uptime').textContent = hours ? hours + 'h ' + minutes + 'm' : minutes + 'm ' + seconds % 60 + 's';
}

async function probe() {
  const button = byId('check');
  if (button.disabled) return;
  button.disabled = true;
  const start = performance.now();
  let healthy = false;
  let result = 'Unavailable';
  try {
    const response = await fetch(apiBase + '/api/status', {cache:'no-store', signal:AbortSignal.timeout(8000)});
    result = 'HTTP ' + response.status;
    if (response.ok) {
      const payload = await response.json();
      byId('serving-note').textContent = payload.release_note || 'Release message unavailable';
      byId('serving-sha').textContent = payload.revision ? 'Revision ' + payload.revision.slice(0, 12) : 'Revision unavailable';
      healthy = payload.status === 'running';
      result = healthy ? 'Healthy' : 'Degraded';
      if (typeof payload.uptime_seconds === 'number') startedAt = performance.now() - payload.uptime_seconds * 1000;
    }
  } catch {
    result = 'Unavailable';
  }
  const elapsed = Math.round(performance.now() - start) + ' ms';
  const now = new Date().toLocaleTimeString();
  checks++;
  if (healthy) {
    successes++;
    byId('latency').textContent = elapsed;
  } else {
    startedAt = null;
    byId('serving-note').textContent = 'Waiting for the service';
    byId('serving-sha').textContent = '';
    byId('uptime').textContent = '—';
  }
  showUptime();
  byId('state').textContent = healthy ? 'Operational' : 'Check failed';
  byId('summary').textContent = 'Last checked at ' + now;
  byId('monitor').dataset.health = healthy ? 'ok' : 'down';
  byId('ratio').textContent = successes + ' / ' + checks;
  const log = byId('activity');
  const row = log.insertRow(0);
  for (const value of [now,'/api/status',result,elapsed]) row.insertCell().textContent = value;
  row.className = healthy ? 'ok' : 'down';
  if (log.rows.length > 30) log.deleteRow(-1);
  button.disabled = false;
}
byId('check').addEventListener('click', probe);
probe();
setInterval(probe, 5000);
setInterval(showUptime, 1000);

byId('request').addEventListener('submit', async event => {
  event.preventDefault();
  const controls = [...event.currentTarget.querySelectorAll('button,select')];
  controls.forEach(control => control.disabled = true);
  byId('http').textContent = 'Requesting…';
  byId('body').textContent = '';
  try {
    const response = await fetch(apiBase + byId('endpoint').value, {cache:'no-store', signal:AbortSignal.timeout(10000)});
    const json = response.headers.get('content-type')?.includes('application/json');
    byId('body').textContent = json ? JSON.stringify(await response.json(), null, 2) : await response.text();
    byId('http').textContent = 'HTTP ' + response.status;
  } catch {
    byId('http').textContent = 'Request failed';
    byId('body').textContent = 'The service could not be reached. Send the request again to retry.';
  } finally {
    controls.forEach(control => control.disabled = false);
  }
});
const repository = 'https://github.com/faizanxbuilds/DeployWatch';
const feed = 'https://raw.githubusercontent.com/faizanxbuilds/DeployWatch/release-feed/latest.json';

function evidence(id, path, label) {
  const link = byId(id);
  link.href = repository + path;
  link.textContent = label;
  link.hidden = false;
}

async function refreshRelease() {
  try {
    const response = await fetch(feed + '?t=' + Math.floor(Date.now() / 5000), {
      cache: 'no-store', signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error('Release feed unavailable');
    const release = await response.json();
    byId('release-message').textContent = release.message;
    byId('release-note').textContent = release.note;
    evidence('source-link', '/commit/' + release.revision, 'Commit ' + release.revision.slice(0, 7));
    evidence('run-link', '/actions/runs/' + release.run, 'Workflow run ↗');
    byId('helm-link').hidden = true;
    if (release.helm_revision) evidence('helm-link', '/commit/' + release.helm_revision, 'Inspect the Helm commit ↗');
    for (const row of document.querySelectorAll('[data-event]')) {
      const timestamp = release.events[row.dataset.event];
      row.classList.toggle('done', Boolean(timestamp));
      row.querySelector('span').textContent = timestamp ? new Date(timestamp).toLocaleString() : 'Pending';
    }
    byId('release-status').textContent = release.events.failed ? 'Workflow failed. Open the workflow run for details.'
      : release.events.live ? 'Deployment confirmed. Watching for the next push.' : 'Release in progress.';
  } catch {
    byId('release-status').textContent = 'Release feed unavailable. Retrying automatically.';
  } finally {
    setTimeout(refreshRelease, 5000);
  }
}
refreshRelease();
