import * as moment from 'moment';
import { PERIODS } from './enums';

export const getDatesByType = (
  type: number,
  startDate: Date,
  endDate: Date,
) => {
  let currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - type);
  if (type === PERIODS.past7d || type === PERIODS.past30d) {
    currentDate = moment(currentDate).startOf('day').toDate();
  }
  const gteValue =
    type === PERIODS.range
      ? moment(startDate).startOf('day').toDate()
      : currentDate;
  const lteValue =
    type === PERIODS.range ? moment(endDate).endOf('day').toDate() : undefined;

  return { gteValue, lteValue };
};

export const createObjForAreaChart = (
  dates: Date[],
  type: number,
  gteValue: Date,
  lteValue: Date | undefined,
) => {
  const obj = createEmptyObjectForType(type, gteValue, lteValue);
  dates.map((date) => {
    if (type !== PERIODS.past24h) {
      date.setHours(0);
    }
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    const resValue = obj.find((res) => res.date.getTime() === date.getTime());
    if (resValue) {
      resValue.value++;
    }
  });

  const response = obj
    .sort((a, b) => {
      return a.date.getTime() - b.date.getTime();
    })
    .map((objValue) => {
      return {
        ...objValue,
        date: formatDateByType(type, objValue.date),
      };
    });

  return response;
};

const createEmptyObjectForType = (
  type: number,
  gteValue: Date,
  lteValue: Date | undefined,
) => {
  const obj: {
    date: Date;
    value: number;
  }[] = [];
  if (type === PERIODS.past24h) {
    gteValue.setHours(gteValue.getHours() + 1);
    gteValue.setMinutes(0);
    gteValue.setSeconds(0);
    gteValue.setMilliseconds(0);
    obj.push({
      date: gteValue,
      value: 0,
    });
    for (let i = 1; i < 24; i++) {
      const newDate = new Date(gteValue);
      newDate.setHours(gteValue.getHours() + i);
      obj.push({
        date: newDate,
        value: 0,
      });
    }
  } else {
    if (type !== PERIODS.allTime && type !== PERIODS.range) {
      gteValue.setDate(gteValue.getDate() + 1);
    }
    gteValue.setHours(0);
    gteValue.setMinutes(0);
    gteValue.setSeconds(0);
    gteValue.setMilliseconds(0);
    obj.push({
      date: gteValue,
      value: 0,
    });
    const newDate = new Date(gteValue);
    newDate.setDate(newDate.getDate() + 1);
    const currDate = lteValue ?? new Date();
    while (newDate.getTime() < currDate.getTime()) {
      obj.push({
        date: new Date(newDate),
        value: 0,
      });
      newDate.setDate(newDate.getDate() + 1);
    }
  }

  return obj;
};

const formatDateByType = (type: number, date: Date) => {
  if (type === PERIODS.past24h) {
    return moment(date).format('HH:mm');
  } else {
    return moment(date).format('MM/DD');
  }
};
