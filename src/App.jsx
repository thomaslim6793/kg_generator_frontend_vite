import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Network } from 'vis-network';
import './App.css'; // Import the CSS file

const default_text = `The human immune system is a complex network of cells, tissues, and organs that work together to defend the body against pathogens such as bacteria, viruses, and other harmful agents. Central to this defense are white blood cells, which identify and eliminate foreign invaders. One key component of the immune response is the production of antibodies by B cells, which bind to specific antigens on the surface of pathogens, neutralizing them or marking them for destruction by other immune cells. T cells, another critical group of immune cells, directly attack infected or cancerous cells. The immune system also possesses memory, allowing it to mount a faster and stronger response upon re-exposure to the same pathogen. However, this intricate defense system can sometimes malfunction, leading to autoimmune diseases, where the immune system mistakenly attacks the body’s own tissues, or immunodeficiencies, where its ability to fight infections is impaired.`;

function App() {
  const [inputText, setInputText] = useState(default_text);  // Default text
  const [triplets, setTriplets] = useState([]);
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

  const handleSubmit = async () => {
    if (!inputText.trim()) {
      alert('Please enter some text.');
      return;
    }

    // Calculate the length of the input text
    const textLength = inputText.length;

    // Calculate length_penalty based on text length
    const lengthPenalty = calculateLengthPenalty(textLength);

    // Optional: Log the values for debugging
    console.log(`Input Text Length: ${textLength}`);
    console.log(`Calculated Length Penalty: ${lengthPenalty}`);

    const gen_kwargs = {
      "num_beams": 50,
      "max_length": 512,
      "length_penalty": lengthPenalty,
      "num_return_sequences": 1
    };

    try {
      // Send request to the SageMaker endpoint
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_ENDPOINT}/generate`, {
        text: inputText,
        gen_kwargs: gen_kwargs,  // Send gen_kwargs with the request
      });
      setTriplets(response.data.triplets);
    } catch (error) {
      console.error('Error fetching triplets:', error);
      alert('An error occurred while processing your request.');
    }
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
        <button onClick={handleSubmit}>Run Model</button>
        <button onClick={handleDownloadJSON} disabled={triplets.length === 0}>
          Download JSON
        </button>
      </div>
      <div className="graph-section" ref={networkContainer}></div>
    </div>
  );
}

export default App;