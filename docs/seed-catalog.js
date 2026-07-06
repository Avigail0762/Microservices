use('catalogdb');

db.donors.updateOne(
  { _id: 1 },
  {
    $setOnInsert: {
      _id: 1,
      firstName: 'Seed',
      lastName: 'Donor',
      email: 'seed-donor@example.com',
      phoneNumber: '0000000',
      address: 'seed'
    }
  },
  { upsert: true }
);

db.gifts.updateOne(
  { _id: 1001 },
  {
    $setOnInsert: {
      _id: 1001,
      name: 'Seed Gift',
      description: 'seed',
      donorId: 1,
      price: 25,
      buyersNumber: 0,
      category: 'demo',
      winnerTicketId: null,
      isDrawn: false
    }
  },
  { upsert: true }
);

printjson(db.gifts.findOne({ _id: 1001 }));
