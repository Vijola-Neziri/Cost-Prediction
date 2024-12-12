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

async function trainModel(trainData) {
  const model = tf.sequential();
  model.add(tf.layers.dense({ units: 1, inputShape: [1] }));
  model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });

  const xs = tf.tensor1d(trainData.map((item) => parseFloat(item.categoryIndex || 0)));
  const ys = tf.tensor1d(trainData.map((item) => parseFloat(item.price || 0)));

  const result = await model.fit(xs, ys, {
    epochs: 100,
    batchSize: Math.min(32, Math.floor(trainData.length / 10)),
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch + 1}: Loss = ${logs.loss}`);
      },
    },
  });

  console.log('Model training completed.');
  return model;
}

async function predictPriceWithAI(model, categoryIndex) {
  const inputTensor = tf.tensor2d([[categoryIndex]]);
  const prediction = model.predict(inputTensor);
  return prediction.dataSync()[0];
}

function prepareData(data) {
  const categories = [...new Set(data.map((item) => item.category))];
  data.forEach((item) => {
    item.categoryIndex = categories.indexOf(item.category);
  });
  return data;
}

function splitDataset(data, trainSplit = 0.8) {
  const shuffled = [...data].sort(() => Math.random() - 0.5);
  const trainSize = Math.floor(shuffled.length * trainSplit);
  return {
    trainData: shuffled.slice(0, trainSize),
    testData: shuffled.slice(trainSize),
  };
}

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
    
      if (price < 20) acc['<20'] = acc['<20'] ? acc['<20'] + 1 : 1;
      else if (price < 50) acc['20-50'] = acc['20-50'] ? acc['20-50'] + 1 : 1;
      else if (price < 100) acc['50-100'] = acc['50-100'] ? acc['50-100'] + 1 : 1;
      else if (price < 150) acc['100-150'] = acc['100-150'] ? acc['100-150'] + 1 : 1;
      else if (price < 200) acc['150-200'] = acc['150-200'] ? acc['150-200'] + 1 : 1;
      else if (price < 300) acc['200-300'] = acc['200-300'] ? acc['200-300'] + 1 : 1;
      else if (price < 500) acc['300-500'] = acc['300-500'] ? acc['300-500'] + 1 : 1;
      else acc['>500'] = acc['>500'] ? acc['>500'] + 1 : 1;
    
      return acc;
    }, {});
    

  return { groupedByCategory, totalProducts, averagePrice, priceRanges };
}

app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded');
  }

  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on('data', (row) => {
      results.push(row);
    })
    .on('end', async () => {
      try {
        const preparedData = prepareData(results);
        const { trainData, testData } = splitDataset(preparedData);

        const model = await trainModel(trainData);

        const testXs = tf.tensor1d(testData.map((item) => parseFloat(item.categoryIndex || 0)));
        const testYs = tf.tensor1d(testData.map((item) => parseFloat(item.price || 0)));
        const evaluation = model.evaluate(testXs, testYs);
        console.log(`Model evaluation (MSE): ${evaluation.dataSync()[0]}`);

        const predictedPrices = {};
        const uniqueCategories = [...new Set(results.map((item) => item.category))];
        for (const category of uniqueCategories) {
          const categoryIndex = preparedData.find((item) => item.category === category)?.categoryIndex;
          if (categoryIndex !== undefined) {
            predictedPrices[category] = await predictPriceWithAI(model, categoryIndex);
          }
        }

        const analysisResult = analyzeData(results);
        analysisResult.predictedPrices = predictedPrices;

        fs.unlinkSync(req.file.path); // Cleanup uploaded file
        res.json(analysisResult);
      } catch (error) {
        console.error('Error processing data:', error);
        res.status(500).send('Failed to process the data');
      }
    })
    .on('error', (error) => {
      console.error('Error processing file:', error);
      res.status(500).send('Failed to process the file');
    });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
