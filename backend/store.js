const fs = require('node:fs');
const path = require('node:path');

module.exports = function createStore(dataDirectory = path.join(__dirname, 'data')) {
  const read = (name) =>
    JSON.parse(fs.readFileSync(path.join(dataDirectory, `${name}.json`), 'utf8'));
  return {
    readQuestions: () => read('questions'),
    readSessions() {
      try {
        return read('sessions');
      } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
      }
    },
    saveSessions(sessions) {
      const file = path.join(dataDirectory, 'sessions.json');
      // Keep the previous file intact if writing is interrupted.
      fs.writeFileSync(`${file}.tmp`, JSON.stringify(sessions, null, 2));
      fs.renameSync(`${file}.tmp`, file);
    },
  };
};
