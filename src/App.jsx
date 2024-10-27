import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Network } from 'vis-network';
import './App.css'; // Import the CSS file

const default_text = `The human immune system is a complex network of cells, tissues, and organs that work together to defend the body against pathogens such as bacteria, viruses, and other harmful agents. Central to this defense are white blood cells, which identify and eliminate foreign invaders. One key component of the immune response is the production of antibodies by B cells, which bind to specific antigens on the surface of pathogens, neutralizing them or marking them for destruction by other immune cells. T cells, another critical group of immune cells, directly attack infected or cancerous cells.`;

function App() {
  const [inputText, setInputText] = useState(default_text);  // Default text
  const [triplets, setTriplets] = useState([]);
  const [loading, setLoading] = useState(false);  // Add loading state
  const networkContainer = useRef(null);
  const networkInstance = useRef(null);

  // Helper function to calculate length_penalty
  const calculateLengthPenalty = (textLength, minLength = 100, maxLength = 1000, minPenalty = 1, maxPenalty = 10) => {
    if (textLength <= minLength) return minPenalty;
    if (textLength >= maxLength) return maxPenalty;

    // Linear interpolation
    const slope = (maxPenalty - minPenalty) / (maxLength - minLength);
    return minPenalty + slope * (textLength - minLength);
  };

  // Function to calculate num_return_sequences based on text length
  const calculateNumRetSeq = (textLength, minLength = 100, maxLength = 1000, minSeq = 1, maxSeq = 5) => {
    if (textLength <= minLength) return minSeq;
    if (textLength >= maxLength) return maxSeq;

    // Linear interpolation to calculate num_return_sequences
    const slope = (maxSeq - minSeq) / (maxLength - minLength);
    const numSeq = Math.round(minSeq + slope * (textLength - minLength));  // Ensure result is an integer

    return numSeq;
  };
  
  // Function to send inference request
  const sendInference = async (text, gen_kwargs) => {
    try {
      const response = await axios({
        method: 'POST',
        url: `${import.meta.env.VITE_BACKEND_ENDPOINT}/generate`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        data: {
          text: text,  // Ensure the payload text is sent in plain text format
          gen_kwargs: gen_kwargs,
        },
      });

      if (response.data && response.data.triplets) {
        return response.data.triplets;
      }
      return null;
    } catch (error) {
      if (error.response) {
        alert(`Server Error: ${error.response.data.detail || 'Unknown error'}`);
      } else if (error.request) {
        alert('No response from the server. Please try again later.');
      } else {
        alert(`Error: ${error.message}`);
      }
      return null;
    }
  };

  // Handle the actual inference when "Run Model" is clicked
  const handleSubmit = async () => {
    console.log('handleSubmit: Run Model button clicked.');

    if (!inputText.trim()) {
      console.warn('handleSubmit: Input text is empty.');
      alert('Please enter some text.');
      return;
    }

    setLoading(true);  // Start loading animation
    console.log('handleSubmit: Loading state set to true.');

    // Calculate the length of the input text
    const textLength = inputText.length;
    console.log('handleSubmit: Text Length:', textLength);

    // Calculate length_penalty based on text length
    const lengthPenalty = calculateLengthPenalty(textLength);
    console.log('handleSubmit: Calculated length_penalty:', lengthPenalty);

    // Calculate num_return_sequences based on text length
    const numReturnSequences = calculateNumRetSeq(textLength);
    console.log('handleSubmit: Calculated num_return_sequences:', numReturnSequences);

    const gen_kwargs = {
      "num_beams": 10,
      "max_length": 256,
      "length_penalty": lengthPenalty,
      "num_return_sequences": numReturnSequences
    };
    console.log('handleSubmit: Generation Arguments:', gen_kwargs);

    const tripletsResult = await sendInference(inputText, gen_kwargs);
    if (tripletsResult) {
      console.log('handleSubmit: Setting triplets state.');
      setTriplets(tripletsResult);
    } else {
      console.warn('handleSubmit: No triplets received.');
    }

    setLoading(false);  // Stop loading animation
    console.log('handleSubmit: Loading state set to false.');
  };

  const handleDownloadJSON = () => {
    if (triplets.length === 0) {
      alert('No triplets to download.');
      return;
    }

    // Convert triplets to JSON string
    const jsonString = JSON.stringify(triplets, null, 2);

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: 'application/json' });

    // Generate a temporary URL for the Blob
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'knowledge_graph_triplets.json';

    // Append the anchor to the body, trigger click, and remove it
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Release the object URL
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (triplets.length > 0 && networkContainer.current) {
      const nodesSet = new Set();
      const edges = [];

      triplets.forEach(({ head, type, tail }) => {
        nodesSet.add(head);
        nodesSet.add(tail);
        edges.push({
          from: head,
          to: tail,
          label: type,
          arrows: 'to',
        });
      });

      const nodes = Array.from(nodesSet).map((node) => ({
        id: node,
        label: node,
      }));

      const data = { nodes, edges };
      const options = {
        layout: {
          improvedLayout: true,
        },
        edges: {
          color: '#000000',
          smooth: {
            type: 'continuous',
          },
        },
        nodes: {
          shape: 'dot',
          size: 16,
          font: {
            size: 14,
            color: '#000000',
          },
          borderWidth: 2,
        },
        physics: {
          enabled: true,
          barnesHut: {
            gravitationalConstant: -8000,
            springLength: 250,
          },
        },
      };

      if (networkInstance.current) {
        networkInstance.current.setData(data);
      } else {
        networkInstance.current = new Network(
          networkContainer.current,
          data,
          options
        );
      }
    }
  }, [triplets]);

  return (
    <div className="app-container">
      <div className="input-section">
        <h2>Knowledge Graph Generator</h2>
        <textarea
          placeholder="Type or paste your text here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
        ></textarea>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Processing...' : 'Run Model'}
        </button>
        <button onClick={handleDownloadJSON} disabled={triplets.length === 0}>
          Download Knowledge Graph in JSON
        </button>
        {loading && (
          <div className="loading-container">
            <div className="spinner"></div>
            <div className="loading-text">
              <div>Loading...</div>
              <div>(this process may take up to 1 minute)</div>
            </div>
          </div>
        )}
      </div>
      <div className="graph-section" ref={networkContainer}></div>
    </div>
  );
}

export default App;