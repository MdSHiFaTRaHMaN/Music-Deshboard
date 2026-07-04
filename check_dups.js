import mongoose from 'mongoose';
const uri = 'mongodb+srv://MusicGnDbAdmiN:GkYAduRVi2yU9uGE@cluster001.2yvlo7m.mongodb.net/MusicGEnarateDB?appName=Cluster001';
mongoose.connect(uri).then(async () => {
  const Order = mongoose.connection.collection('orders');
  const result = await Order.aggregate([
    { $group: { _id: '$shopifyOrderId', count: { $sum: 1 } } }
  ]).toArray();
  console.log('shopifyOrderIds:', result);
  process.exit(0);
});
