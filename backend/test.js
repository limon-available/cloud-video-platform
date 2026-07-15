const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const mongoose = require("mongoose");

mongoose.connect(
  "mongodb+srv://NazmulLimon:Nazmul112097@cluster0.muhelnp.mongodb.net/cloud-video-platform?retryWrites=true&w=majority&appName=Cluster0"
).then(() => {
  console.log("Connected");
  process.exit(0);
}).catch(err => {
  console.error(err);
});