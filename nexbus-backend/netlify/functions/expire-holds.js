// Replaces the built-in timer: releases unpaid seat holds every minute (see netlify.toml / config below)
const bookingService = require('../../services/booking.service');

module.exports.handler = async () => {
  const released = await bookingService.expireHolds();
  console.log('expire-holds', JSON.stringify(released));
  return { statusCode: 200 };
};

module.exports.config = { schedule: '* * * * *' };
