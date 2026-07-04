import { MongoClient } from 'mongodb';

const oldUri = "mongodb+srv://MgDbAauSeR:VRWRbi6is6gNzAf9@cluster0.dqvtoqn.mongodb.net/MusicAPPDB?appName=Cluster0";
const newUri = "mongodb+srv://MusicGnDbAdmiN:GkYAduRVi2yU9uGE@cluster001.2yvlo7m.mongodb.net/MusicGEnarateDB?appName=Cluster001";

async function migrate() {
  console.log("Connecting to old database...");
  const oldClient = new MongoClient(oldUri);
  await oldClient.connect();
  const oldDb = oldClient.db("MusicAPPDB");
  const oldOrdersCollection = oldDb.collection("orders");

  console.log("Fetching orders from old database...");
  const orders = await oldOrdersCollection.find({}).toArray();
  console.log(`Found ${orders.length} orders.`);

  if (orders.length === 0) {
    console.log("No orders to migrate. Exiting.");
    await oldClient.close();
    return;
  }

  console.log("Connecting to new database...");
  const newClient = new MongoClient(newUri);
  await newClient.connect();
  const newDb = newClient.db("MusicGEnarateDB");
  const newOrdersCollection = newDb.collection("orders");

  console.log("Inserting orders into new database...");
  try {
    // Avoid duplicate key errors if some already exist by inserting one by one or handling errors
    const result = await newOrdersCollection.insertMany(orders, { ordered: false });
    console.log(`Successfully inserted ${result.insertedCount} orders.`);
  } catch (error) {
    if (error.code === 11000) {
      console.log(`Successfully inserted ${error.result.nInserted} orders. Some orders already existed and were skipped.`);
    } else {
      console.error("Error inserting orders:", error);
    }
  }

  await oldClient.close();
  await newClient.close();
  console.log("Migration complete!");
}

migrate().catch(console.error);
