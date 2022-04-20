const mongoose = require('mongoose');
const Schema = mongoose.Schema;


const faceSchema = new Schema({
    label: {
        type: String,
        required: true,
        unique: true,

    },
    descriptions: {
      type: Array,
      required: true,
    },
});

module.exports = mongoose.model("Face", faceSchema);