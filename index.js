if (process.env.NODE_ENV !== "production") {
  require('dotenv').config(); 
}

const express = require("express");
const app = express();
const faceapi = require("face-api.js");
const mongoose = require("mongoose");
const { Canvas, Image } = require("canvas");
const canvas = require("canvas");
// const fileUpload = require("express-fileupload");
const FaceModel = require('./db-model/facedbmodel');
const path = require('path');
const multer  = require('multer')
const {storage} = require('./cloudinary');
const { url } = require('inspector');
const { findOne } = require('./db-model/facedbmodel');
const { addAbortSignal } = require('stream');
const upload = multer({ storage})
const { v4: uuid } = require('uuid');
faceapi.env.monkeyPatch({ Canvas, Image });


app.set('view engine','ejs');
app.set('views', path.join(__dirname,'views'))

mongoose.connect('mongodb://localhost:27017/faces')

// app.use(
//   fileUpload({useTempFiles: true})
// );



async function LoadModels() {
    // Load the models
    // __dirname gives the root directory of the server
    await faceapi.nets.faceRecognitionNet.loadFromDisk(__dirname + "/models");
    await faceapi.nets.faceLandmark68Net.loadFromDisk(__dirname + "/models");
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(__dirname + "/models");
  }
  LoadModels();



  async function uploadLabeledImages(images, label, url,filename) {
    try {
  
      const descriptions = [];
      // Loop through the images
      for (let i = 0; i < images.length; i++) {
        const img = await canvas.loadImage(images[i]);
        // Read each face and save the face descriptions in the descriptions array
        const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
  
      // Create a new face document with the given label and save it in DB
      const createFace = new FaceModel({
        label: label,
        descriptions: descriptions,
        imagedata:[
          {
           url: url,
           filename: filename,
          }
        ]
      });
      await createFace.save(); 
      return true;
    } catch (error) {
      console.log(error);
      return (error);
    }
  }
  
  app.get('/post-face', (req, res) => {
    res.render('rec')
  })
  app.post("/post-face",upload.single('File1'),async (req,res)=>{
    const File1= req.file.path;
    const label = uuid();
    const url = req.file.path
    const filename = req.file.filename
    let result = await uploadLabeledImages([File1], label,url,filename);
    if(result){

        res.json({message:"Face data stored successfully"})
    }else{
        res.json({message:"Something went wrong, please try again."})

    }
})

async function getDescriptorsFromDB(image) {
    // Get all the face data from mongodb and loop through each of them to read the data
    let faces = await FaceModel.find();
    for (i = 0; i < faces.length; i++) {
      // Change the face data descriptors from Objects to Float32Array type
      for (j = 0; j < faces[i].descriptions.length; j++) {
        faces[i].descriptions[j] = new Float32Array(Object.values(faces[i].descriptions[j]));
      }
      // Turn the DB face docs to
      faces[i] = new faceapi.LabeledFaceDescriptors(faces[i].label, faces[i].descriptions);
    }
  
    // Load face matcher to find the matching face
    const faceMatcher = new faceapi.FaceMatcher(faces, 0.6);
  
    // Read the image using canvas or other method
    const img = await canvas.loadImage(image);
    let temp = faceapi.createCanvasFromMedia(img);
    // Process the image for the model
    const displaySize = { width: img.width, height: img.height };
    faceapi.matchDimensions(temp, displaySize);
  
    // Find matching faces
    const detections = await faceapi.detectAllFaces(img).withFaceLandmarks().withFaceDescriptors();
    const resizedDetections = faceapi.resizeResults(detections, displaySize);
    const results = resizedDetections.map((d) => faceMatcher.findBestMatch(d.descriptor));
    return results;
  }

  app.get('/check-face', (req, res) => {
    res.render('check')
  })

  app.post("/check-face",upload.single('File1'), async (req, res) => {

    const File1 = req.file.path;
    let result = await getDescriptorsFromDB(File1);
    const img_id = result.map(f=>(f.label))
    let data = await FaceModel.find({ "label": `${img_id}` })
    res.render("show", { data } )
  
  });


  // app.get("/show", (req,res)=>{
  //   console.log(result)
  //   res.render("show")
  // })

  





app.listen(3000,()=>{
    console.log('port 3000 is ON')
})