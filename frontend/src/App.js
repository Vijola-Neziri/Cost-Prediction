import React, { useState } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { Bar, Pie, Radar, Line } from 'react-chartjs-2';
import axios from 'axios';
import './App.css';
import 'chart.js/auto';
import photo2 from './photo2.jpg';

function App() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const [file, setFile] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [filteredCategories, setFilteredCategories] = useState(null);
  const [isHomePage, setIsHomePage] = useState(true);
  const [showAllColumns, setShowAllColumns] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault();

    if (!file) {
      alert('Please select a file before uploading.');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('http://localhost:3000/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setAnalysisResult(response.data);
      setFilteredCategories(response.data.groupedByCategory);
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('File upload failed. Please check the console for more details.');
    }
  };

  const handleFilterChange = (e) => {
    const filter = e.target.value.toLowerCase();
    setFilterText(filter);

    if (filter && analysisResult?.groupedByCategory) {
      const filtered = Object.keys(analysisResult.groupedByCategory)
        .filter((category) => category.toLowerCase().includes(filter))
        .reduce((acc, key) => {
          acc[key] = analysisResult.groupedByCategory[key];
          return acc;
        }, {});
      setFilteredCategories(filtered);
    } else {
      setFilteredCategories(analysisResult?.groupedByCategory);
    }
  };

  const neutralColors = ['#8B9DC3', '#4F6D7A', '#B0C4DE', '#C0C0C0', '#A9A9A9'];

  const getRadarChartData = () => {
    if (!filteredCategories) return { labels: [], datasets: [] };
  
    const categories = Object.keys(filteredCategories);
    const predictedPrices = categories.map((cat) => {
      const predictedPrice = analysisResult.predictedPrices[cat];
      return predictedPrice || 0; 
    });
  
    return {
      labels: categories,
      datasets: [
        {
          label: 'Predicted Price by Category', 
          data: predictedPrices,
          backgroundColor: 'rgba(137, 141, 153, 0.2)',
          borderColor: '#4F6D7A',
          borderWidth: 2,
          pointBackgroundColor: '#4F6D7A',
          pointBorderColor: '#4F6D7A',
          pointBorderWidth: 1,
          pointRadius: 5,
          
        },
      ],
    };
  };
  
  const getFilteredChartData = (type) => {
    if (!filteredCategories) return { labels: [], datasets: [] };

    const categories = Object.keys(filteredCategories);
    const dataPoints = categories.map((cat) => {
      const items = filteredCategories[cat];
      if (type === 'totalPrice') {
        return items.reduce((sum, product) => sum + parseFloat(product.price || 0), 0);
      } else if (type === 'averagePrice') {
        return (
          items.reduce((sum, product) => sum + parseFloat(product.price || 0), 0) / items.length
        );
      }
      return 0;
    });

    return {
      labels: categories,
      datasets: [
        {
          label: type === 'totalPrice' ? 'Total Prices by Category' : 'Average Price by Category',
          data: dataPoints,
          backgroundColor: neutralColors,
          borderColor: neutralColors.map((color) => color.replace('0.6', '1')),
          borderWidth: 1,
          tension: 0.1,
        },
      ],
    };
  };

  const getPriceDistributionData = () => {
    if (!analysisResult?.priceRanges) return { labels: [], datasets: [] };

    const priceRangeLabels = Object.keys(analysisResult.priceRanges);
    const priceCounts = priceRangeLabels.map((range) => analysisResult.priceRanges[range]);

    return {
      labels: priceRangeLabels,
      datasets: [
        {
          label: 'Price Distribution',
          data: priceCounts,
          backgroundColor: neutralColors,
          hoverOffset: 5,
        },
      ],
    };
  };

  const renderPredictedPrices = () => {
    if (!analysisResult?.predictedPrices) return null;

    const entries = Object.entries(analysisResult.predictedPrices);
    const filteredEntries = filterText
      ? entries.filter(([category]) => category.toLowerCase().includes(filterText.toLowerCase()))
      : entries;
    const displayedEntries = showAllColumns ? filteredEntries : filteredEntries.slice(0, 5);

    return (
      <div className="predicted-prices">
        <h3>Predicted Prices for Categories {filterText && `- Filtered by: ${filterText}`}</h3>
        <table className="predicted-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Predicted Price</th>
            </tr>
          </thead>
          <tbody>
            {displayedEntries.map(([category, price]) => (
              <tr key={category}>
                <td>{category}</td>
                <td>${price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="toggle-columns-btn"
          onClick={() => setShowAllColumns(!showAllColumns)}
        >
          {showAllColumns ? 'Show Less' : 'Show More'}
        </button>
      </div>
    );
  };

  return (
    <Router>
      <div className="App">
        {isHomePage ? (
          <div className="home-page">
            <div className="home-content">
              <div className="image-content">
                <img src={photo2} alt="AI/ML Model" className="home-image" />
              </div>
              <div className="text-content">
                <h1>The development of a model for financial cost prediction using AI/ML algorithms</h1>
                <p>
                Artificial Intelligence (AI) and Machine Learning (ML) technologies have transformed the way financial data is analyzed and forecasted.
                 These advancements enable the identification of financial trends and provide accurate cost predictions with improved efficiency.
                </p>
                <button className="start-btn" onClick={() => setIsHomePage(false)}>
                  Start Model Development
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="upload-page">
            <div className="header">
              <h1>Data Analysis & AI Predictions</h1>
              <p>Upload your product data and get AI-driven insights and predictions!</p>
              <button className="back-btn" onClick={() => setIsHomePage(true)}>
                Return back
              </button>
            </div>

            <form onSubmit={handleFileUpload} className="upload-form">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  if (e.target.files.length > 0) {
                    setFile(e.target.files[0]);
                  } else {
                    alert('No file selected.');
                  }
                }}
              />
              <button type="submit" className="upload-btn">Upload</button>
            </form>

            {analysisResult && (
              <div className="analysis-results">
                {/* Dashboard */}
                <div className="stats-box">
                  <div className="stat-item1">
                    <h3>Dashboard</h3>
                    <div className="stat-item2">
                      <div className="stat-item">
                        <h3> 🛒Total Products</h3>
                        <p>{analysisResult.totalProducts}</p>
                      </div>
                      <div className="stat-item">
                        <h3> 💰Average Price</h3>
                        <p>${analysisResult.averagePrice.toFixed(2)}</p>
                      </div>
                      <div className="stat-item">
                        <h3>📊Types of Charts</h3>
                        <p>Radar, Bar, Pie, Line</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Filter */}
                <h2 className="center-title">Filter Category</h2>
                <div className="filter-container">
                  <div className="filter-box">
                    <input
                      type="text"
                      placeholder="🔍 Filter by category..."
                      value={filterText}
                      onChange={handleFilterChange}
                      className="filter-input"
                    />
                    <button
                      className="clear-filter-btn"
                      onClick={() => setFilterText('')}
                    >
                      Reset
                    </button>
                  </div>
                  {filteredCategories && Object.keys(filteredCategories).length === 0 && (
                    <p className="no-results">No categories match your filter.</p>
                  )}
                </div>

                {renderPredictedPrices()}

                {/* Charts */}
                <div className="charts-container">
                  <div className="chart-row">
                    <div className="chart-box small-box">
                      <Radar data={getRadarChartData()} />
                      <div className="chart-description">
                        <p>This radar chart shows the predicted price by category</p>
                      </div>
                    </div>
                    <div className="chart-box large-box">
                      <Bar data={getFilteredChartData('totalPrice')} />
                      <div className="chart-description">
                        <p>Total price by category.</p>
                      </div>
                    </div>
                  </div>

                  <div className="chart-row">
                    <div className="chart-box small-box">
                      <Pie data={getPriceDistributionData()} />
                      <div className="chart-description">
                        <p>Price distribution across product categories.</p>
                      </div>
                    </div>
                    <div className="chart-box large-box">
                      <Line data={getFilteredChartData('averagePrice')} />
                      <div className="chart-description">
                        <p>Average price by category.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
