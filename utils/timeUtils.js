const moment = require('moment-timezone');


const convertToPKT = (dateTime) => {
  return moment.utc(dateTime).tz('Asia/Karachi');
};


const convertToPKTAndSubtractHours = (date, time, hoursToSubtract = 5) => {
  let dateTimeString;
  
  if (typeof date === 'string' && typeof time === 'string') {
    // date + time in strings
    dateTimeString = `${date}T${time}`;
  } else if (moment.isMoment(date) && typeof time === 'string') {
    // date = moment, time = string
    dateTimeString = `${date.format('YYYY-MM-DD')}T${time.split('T')[1]}`;
  } else if (moment.isMoment(date) && moment.isMoment(time)) {
    // date = moment, time = moment
    dateTimeString = `${date.format('YYYY-MM-DD')}T${time.format('HH:mm:ss')}`;
  } else if (typeof date === 'string' && time === undefined) {
    // date = string, time = NA (when time is already in the date-string, all such instances are replaced by "undefined" in the 2nd paramenters)
    dateTimeString = date;
  } else {
    throw new Error('Unsupported input types for date/time conversion');
  }
  
  return moment.tz(dateTimeString, 'Asia/Karachi').subtract(hoursToSubtract, 'hours');
};

const convertDateStringToPKT = (dateString) => {
  return moment.tz(dateString, 'Asia/Karachi');
};

const formatTimeInPKT = (dateTime, format = 'HH:mm') => {
  return moment.utc(dateTime).tz('Asia/Karachi').format(format);
};

const createDateTimeInPKT = (dateOnly, timeOnly) => {
  return `${dateOnly}T${timeOnly}`;
};

const calculateDurationHours = (startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  return (end - start) / (1000 * 60 * 60); // Convert ms to hours
};

const isWeekend = (date) => {
  const day = new Date(date).getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
};

const getDayBoundariesInPKT = (date) => {
  const pktDate = convertToPKT(date);
  return {
    startOfDay: pktDate.clone().startOf('day'),
    endOfDay: pktDate.clone().endOf('day')
  };
};

module.exports = {
  convertToPKT,
  convertToPKTAndSubtractHours,
  convertDateStringToPKT,
  formatTimeInPKT,
  createDateTimeInPKT,
  calculateDurationHours,
  isWeekend,
  getDayBoundariesInPKT
};
