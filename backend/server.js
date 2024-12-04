const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser');
const tf = require('@tensorflow/tfjs-node');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const upload = multer({ dest: 'uploads/', limits: { fileSize: 50 * 1024 * 1024 } }); 

// Train a TensorFlow model for regression
async function trainModel(trainData) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
  model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });

  const xs = tf.tensor1d(trainData.map((item) => parseFloat(item.categoryIndex || 0)));
  const ys = tf.tensor1d(trainData.map((item) => parseFloat(item.price || 0)));

  await model.fit(xs, ys, { epochs: 100, batchSize: Math.min(32, trainData.length / 10) });
  return model;
}

// Predict price with the trained AI model
async function predictPriceWithAI(model, categoryIndex) {
  const inputTensor = tf.tensor2d([[categoryIndex]]);
  const prediction = model.predict(inputTensor);
  return prediction.dataSync()[0];
}

// Prepare data for TensorFlow model
function prepareData(data) {
  const categories = [...new Set(data.map((item) => item.category))];
  data.forEach((item) => {
    item.categoryIndex = categories.indexOf(item.category);
  });
  return data;
}

// Split dataset into training and testing subsets
function splitDataset(data, trainSplit = 0.8) {
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  const trainSize = Math.floor(shuffled.length * trainSplit);
  const trainData = shuffled.slice(0, trainSize);
  const testData = shuffled.slice(trainSize);
  return { trainData, testData };
}


// Analyze uploaded data
function analyzeData(data) {
  const groupedByCategory = data.reduce((acc, item) => {
    acc[item.category] = acc[item.category] || [];
    acc[item.category].push(item);
    return acc;
  }, {});

  const totalProducts = data.length;
  const averagePrice =
    data.reduce((sum, item) => sum + parseFloat(item.price || 0), 0) / totalProducts;

  const priceRanges = data.reduce((acc, item) => {
    const price = parseFloat(item.price || 0);
    if (price < 50) acc['<50'] = (acc['<50'] || 0) + 1;
    else if (price < 100) acc['50-100'] = (acc['50-100'] || 0) + 1;
    else if (price < 150) acc['100-150'] = (acc['100-150'] || 0) + 1;
    else if (price < 200) acc['150-200'] = (acc['150-200'] || 0) + 1;
    else if (price < 500) acc['200-500'] = (acc['200-500'] || 0) + 1;
    else acc['>500'] = (acc['>500'] || 0) + 1;

    return acc;
  }, {});

  // Calculate average height for products
  const averageHeight = data.reduce((sum, item) => sum + parseFloat(item.height || 0), 0) / totalProducts;

  return { groupedByCategory, totalProducts, averagePrice, priceRanges };
}

// Handle file upload and data processing
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded.' });
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        const preparedData = prepareData(results);

        // Split the dataset into training and testing data
        const { trainData, testData } = splitDataset(preparedData);

        // Train the model using the training data
        const model = await trainModel(trainData);

        // Predict price for all categories
        const predictedPrices = {};
        const categories = [...new Set(results.map((item) => item.category))];
        for (const category of categories) {
          const categoryIndex = preparedData.find((item) => item.category === category).categoryIndex;
          const predictedPrice = await predictPriceWithAI(model, categoryIndex);
          predictedPrices[category] = predictedPrice;
        }

        const analysis = analyzeData(preparedData);
        res.json({
          ...analysis,
          predictedPrices,
          trainDataCount: trainData.length,
          testDataCount: testData.length,
        });
      } catch (error) {
        console.error('Error processing data:', error);
        res.status(500).json({ error: 'Error processing data' });
      } finally {
        fs.unlinkSync(req.file.path); // Clean up uploaded file
      }
    });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
