// Deletes location logs older than their retention date, once a day
const tracking = require('../../services/tracking.service');

module.exports.handler = async () => {
  const removed = await tracking.purgeOldLogs();
  console.log('purge-logs', JSON.stringify(removed));
  return { statusCode: 200 };
};

module.exports.config = { schedule: '0 21 * * *' };
