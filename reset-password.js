const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb+srv://MgDbAauSeR:VRWRbi6is6gNzAf9@cluster0.dqvtoqn.mongodb.net/MusicAPPDB?appName=Cluster0')
  .then(async () => {
    const db = mongoose.connection;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);
    const result = await db.collection('users').updateOne(
      { email: 'admin@musicapp.com' },
      { $set: { password: hashedPassword } }
    );
    console.log('Update result:', result);
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
