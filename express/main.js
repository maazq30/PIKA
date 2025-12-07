const express = require('express');
const cors = require('cors'); // ⬅️ you forgot this
const User = require("./models/User");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI);
const app = express();
const port = 3000;
const mongoose = require("mongoose");

mongoose
  .connect(uri)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
app.use(cors());
app.use(express.json());




app.get('/users',async (req, res) => {
    try{
        const users = await User.find();
        res.status(200).json(users);
    } catch(err){
        res.status(500).json({ error: 'Server error' });        
    }
});


app.get('/users/:id', async (req, res) => {
    const id = req.params.id
    try{
        const user = await User.findById(id);
        if(!user){
            return res.status(404).json({ error: 'User not found' });
        }
    res.status(200).json(user);
    } 
    
    catch(err){
        return res.status(500).json({ error: 'Server error' });
    }
   
});


app.post('/users', async (req, res) => {
    const {name} = req.body;
    if(!name){
        return res.status(400).json({ error: 'Name is required' });
    }
    try{
        const newUser = await User.create({name})
        res.status(201).json(newUser);
    } catch(err){
        return res.status(500).json({ error: 'Server error' });
    }
   


});

app.put('/users/:id', async (req, res) => {
    const id  = req.params.id
    const { name } = req.body;
    
try{
    const updatedUser = await User.findByIdAndUpdate(id, { name }, { new: true });
  
  if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    console.error("PUT /users/:id error:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

app.delete('/users/:id', async (req, res) => {
  const id = req.params.id;

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(deletedUser);
  } catch (err) {
    console.error("DELETE /users/:id error:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});     


