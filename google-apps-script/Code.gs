const STATE_FILE_NAME = 'siwanchi-premier-league-auction-state.json';

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function authorized(secret) {
  return secret && secret === PropertiesService.getScriptProperties().getProperty('AUCTION_SYNC_SECRET');
}

function findStateFile() {
  const files = DriveApp.getFilesByName(STATE_FILE_NAME);
  return files.hasNext() ? files.next() : null;
}

function doGet(event) {
  if (!authorized(event.parameter.secret))
    return jsonResponse({ ok: false, error: 'Unauthorized' });
  const file = findStateFile();
  if (!file) return jsonResponse({ ok: true, state: null, savedAt: null });
  try {
    const state = JSON.parse(file.getBlob().getDataAsString('UTF-8'));
    return jsonResponse({
      ok: true,
      state: state,
      savedAt: file.getLastUpdated().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: 'Saved JSON is invalid: ' + error.message });
  }
}

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const body = JSON.parse(event.postData.contents || '{}');
    if (!authorized(body.secret))
      return jsonResponse({ ok: false, error: 'Unauthorized' });
    if (body.action !== 'save' || !body.state)
      return jsonResponse({ ok: false, error: 'Invalid save request' });
    lock.waitLock(20000);
    const contents = JSON.stringify(body.state);
    let file = findStateFile();
    if (file) file.setContent(contents);
    else file = DriveApp.createFile(STATE_FILE_NAME, contents, MimeType.PLAIN_TEXT);
    return jsonResponse({
      ok: true,
      savedAt: file.getLastUpdated().toISOString(),
    });
  } catch (error) {
    return jsonResponse({ ok: false, error: error.message });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}
