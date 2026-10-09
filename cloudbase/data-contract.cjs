const SIGNUP_BIND_VALUE_COUNT = 29;

function valuesToRecord(values) {
  if (values.length !== SIGNUP_BIND_VALUE_COUNT) {
    throw new Error(`Expected ${SIGNUP_BIND_VALUE_COUNT} signup values, received ${values.length}`);
  }
  const [id, createdAt, updatedAt, activityId, userId, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, licensePlate, seats, note, smoking, acceptsSmoking, roomType, modificationsJson, modificationOther, depositStatus, interestsJson, signupStatus, contactConsent, notificationConsent] = values;
  return { _id: id, id, createdAt, updatedAt, status: "待匹配", activityId, userId, name, phone, wechat, role, gender, age, zodiac, work, home, pickup, vehicle, licensePlate, seats, note, smoking, acceptsSmoking, roomType, modificationsJson, modificationOther, depositStatus, interestsJson, signupStatus, contactConsent: Boolean(contactConsent), notificationConsent: Boolean(notificationConsent) };
}

function toCloudSignupRow(record) {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    status: record.status,
    activityId: record.activityId,
    userId: record.userId,
    name: record.name,
    phone: record.phone,
    wechat: record.wechat,
    role: record.role,
    gender: record.gender,
    age: record.age,
    zodiac: record.zodiac,
    work: record.work,
    home: record.home,
    pickup: record.pickup,
    vehicle: record.vehicle,
    licensePlate: record.licensePlate,
    seats: record.seats,
    note: record.note,
    smoking: record.smoking,
    acceptsSmoking: record.acceptsSmoking,
    roomType: record.roomType,
    modificationsJson: record.modificationsJson,
    modificationOther: record.modificationOther,
    depositStatus: record.depositStatus,
    interestsJson: record.interestsJson,
    signupStatus: record.signupStatus,
    contactConsent: record.contactConsent,
    notificationConsent: record.notificationConsent
  };
}

module.exports = {
  SIGNUP_BIND_VALUE_COUNT,
  toCloudSignupRow,
  valuesToRecord
};
