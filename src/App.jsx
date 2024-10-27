import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Network } from 'vis-network';
import './App.css'; // Import the CSS file

const default_text = `The human immune system is a complex network of cells, tissues, and organs that work together to defend the body against pathogens such as bacteria, viruses, and other harmful agents. Central to this defense are white blood cells, which identify and eliminate foreign invaders. One key component of the immune response is the production of antibodies by B cells, which bind to specific antigens on the surface of pathogens, neutralizing them or marking them for destruction by other immune cells. T cells, another critical group of immune cells, directly attack infected or cancerous cells. The immune system also possesses memory, allowing it to mount a faster and stronger response upon re-exposure to the same pathogen. However, this intricate defense system can sometimes malfunction, leading to autoimmune diseases, where the immune system mistakenly attacks the body’s own tissues, or immunodeficiencies, where its ability to fight infections is impaired.`;

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
    const penalty = minPenalty + slope * (textLength - minLength);

    return penalty;
  };

  // Function to send inference request
  const sendInference = async (text, gen_kwargs) => {
    console.log('sendInference: Preparing to send inference request.');
    console.log('sendInference: Text Length:', text.length);
    console.log('sendInference: Text:', text);
    console.log('sendInference: Generation Arguments:', gen_kwargs);

    try {
      const response = await axios({
        method: 'POST',
        url: `${import.meta.env.VITE_BACKEND_ENDPOINT}/generate`,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        data: {
          text: text,
          gen_kwargs: gen_kwargs,
        },
      });

      console.log('sendInference: Received response:', response.data);

      if (response.data && response.data.triplets) {
        console.log('sendInference: Triplets received:', response.data.triplets);
        return response.data.triplets;
      } else {
        console.warn('sendInference: Response does not contain triplets:', response.data);
        return null;
      }
    } catch (error) {
      if (error.response) {
        // Server responded with a status other than 2xx
        console.error('sendInference: Server responded with an error:', error.response.data);
        alert(`Server Error: ${error.response.data.detail || 'Unknown error'}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error('sendInference: No response received:', error.request);
        alert('No response from the server. Please try again later.');
      } else {
        // Something else happened
        console.error('sendInference: Error setting up the request:', error.message);
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

    const gen_kwargs = {
      "num_beams": 50,
      "max_length": 512,
      "length_penalty": lengthPenalty,
      "num_return_sequences": 1
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

  // Handle the "warming up" hidden inference on load
  useEffect(() => {
    console.log('useEffect: Warming up the model on component mount.');
    const warmUpText = 'warming up';
    const gen_kwargs = {
      "num_beams": 1,
      "max_length": 10,
      "length_penalty": 1,
      "num_return_sequences": 1
    };
    console.log('useEffect: Warm-up generation arguments:', gen_kwargs);

    // Send the "warming up" hidden inference
    sendInference(warmUpText, gen_kwargs);
  }, []);  // Only run once on mount

  const handleDownloadJSON = () => {
    console.log('handleDownloadJSON: Download JSON button clicked.');

    if (triplets.length === 0) {
      console.warn('handleDownloadJSON: No triplets to download.');
      alert('No triplets to download.');
      return;
    }

    // Convert triplets to JSON string
    const jsonString = JSON.stringify(triplets, null, 2);
    console.log('handleDownloadJSON: JSON string created.');

    // Create a Blob from the JSON string
    const blob = new Blob([jsonString], { type: 'application/json' });
    console.log('handleDownloadJSON: Blob created.');

    // Generate a temporary URL for the Blob
    const url = URL.createObjectURL(blob);
    console.log('handleDownloadJSON: Object URL created:', url);

    // Create a temporary anchor element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'knowledge_graph_triplets.json';
    console.log('handleDownloadJSON: Anchor element created with download attribute.');

    // Append the anchor to the body, trigger click, and remove it
    document.body.appendChild(link);
    console.log('handleDownloadJSON: Anchor appended to the body.');
    link.click();
    console.log('handleDownloadJSON: Anchor clicked to initiate download.');
    document.body.removeChild(link);
    console.log('handleDownloadJSON: Anchor removed from the body.');

    // Release the object URL
    URL.revokeObjectURL(url);
    console.log('handleDownloadJSON: Object URL revoked.');
  };

  useEffect(() => {
    if (triplets.length > 0 && networkContainer.current) {
      console.log('useEffect: Triplets state updated. Preparing to render network graph.');
      const nodesSet = new Set();
      const edges = [];

      triplets.forEach(({ head, type, tail }) => {  // Adjusting the keys based on SageMaker response
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
      console.log('useEffect: Nodes prepared:', nodes);
      console.log('useEffect: Edges prepared:', edges);

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
      console.log('useEffect: Network graph options set.');

      if (networkInstance.current) {
        console.log('useEffect: Updating existing network instance.');
        networkInstance.current.setData(data);
      } else {
        console.log('useEffect: Creating new network instance.');
        networkInstance.current = new Network(
          networkContainer.current,
          data,
          options
        );
        console.log('useEffect: Network instance created.');
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
          onChange={(e) => {
            console.log('Textarea changed. New value:', e.target.value);
            setInputText(e.target.value);
          }}
        ></textarea>
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? 'Processing...' : 'Run Model'}
        </button>
        <button onClick={handleDownloadJSON} disabled={triplets.length === 0}>
          Download Knowledge Graph in JSON
        </button>
        {loading && <div className="loading-animation">Loading...</div>}  {/* Show loading animation */}
      </div>
      <div className="graph-section" ref={networkContainer}></div>
    </div>
  );
}

export default App;