import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Network } from 'vis-network';
import './App.css'; // Import the CSS file

const default_text = `Try this sample text (hit the 'Run Model' button below!): 

Descartes has often been called the father of modern philosophy, and is largely seen as responsible for the increased attention given to epistemology in the 17th century. He laid the foundation for 17th-century continental rationalism, later advocated by Spinoza and Leibniz, and was later opposed by the empiricist school of thought consisting of Hobbes, Locke, Berkeley, and Hume. The rise of early modern rationalism—as a systematic school of philosophy in its own right for the first time in history—exerted an influence on modern Western thought in general, with the birth of two rationalistic philosophical systems of Descartes (Cartesianism) and Spinoza (Spinozism). It was the 17th-century arch-rationalists like Descartes, Spinoza, and Leibniz who have given the "Age of Reason" its name and place in history.`;

function App() {
  const [inputText, setInputText] = useState(default_text);  // Default text
  const [isDefault, setIsDefault] = useState(true); // Track if it's still the default text
  const handleInputChange = (e) => {
    const newText = e.target.value;
    setInputText(newText);
    setIsDefault(newText === default_text); // If the user edits the text, it's no longer default
  };

  const [triplets, setTriplets] = useState([]);
  const [loading, setLoading] = useState(false);  // Add loading state
  const [warmingUp, setWarmingUp] = useState(true); // Track the warm-up process
  const networkContainer = useRef(null);
  const networkInstance = useRef(null);

  // Helper function to calculate length_penalty
  const calculateLengthPenalty = (textLength, minLength = 10, maxLength = 100, minPenalty = 1, maxPenalty = 2) => {
    if (textLength <= minLength) return minPenalty;
    if (textLength >= maxLength) return maxPenalty;

    // Linear interpolation
    const slope = (maxPenalty - minPenalty) / (maxLength - minLength);
    return minPenalty + slope * (textLength - minLength);
  };

  // Function to calculate num_return_sequences based on text length
  const calculateNumRetSeq = (textLength, minLength = 10, maxLength = 100, minSeq = 1, maxSeq = 3) => {
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
    if (!inputText.trim()) {
      alert('Please enter some text.');
      return;
    }

    setLoading(true);  // Start loading animation

    // Calculate the length of the input text
    const textLength = inputText.length;
    const lengthPenalty = calculateLengthPenalty(textLength);
    const numReturnSequences = calculateNumRetSeq(textLength);

    const gen_kwargs = {
      "num_beams": 3, // numBeams increase for better results but slower
      "max_length": 512,
      "length_penalty": 1, // lengthPenalty, if processing without parallelism
      "num_return_sequences": 3 // numReturnSequences, if processing without parallelism
    };

    const tripletsResult = await sendInference(inputText, gen_kwargs);
    if (tripletsResult) {
      setTriplets(tripletsResult);
    }

    setLoading(false);  // Stop loading animation
  };

  // Handle warm-up process
  useEffect(() => {
    const warmUpText = 'Warm up the server';
    const gen_kwargs = {
      "num_beams": 1,
      "max_length": 10,
      "length_penalty": 1,
      "num_return_sequences": 1
    };

    const sendWarmUpInference = async () => {
      try {
        // Send a light warm-up request
        await axios({
          method: 'POST',
          url: `${import.meta.env.VITE_BACKEND_ENDPOINT}/generate`,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          data: {
            text: warmUpText,
            gen_kwargs: gen_kwargs,
          },
        });
        console.log('Warm-up completed.');
      } catch (error) {
        console.error('Warm-up failed:', error.message);
      } finally {
        setWarmingUp(false);  // Stop showing warm-up status once done
      }
    };

    sendWarmUpInference();
  }, []);  // Run only once when the component mounts

  const handleDownloadJSON = () => {
    if (triplets.length === 0) {
      alert('No triplets to download.');
      return;
    }

    // Convert triplets to JSON string
    const jsonString = JSON.stringify(triplets, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger the download
    const link = document.createElement('a');
    link.href = url;
    link.download = 'knowledge_graph_triplets.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
        layout: { improvedLayout: true },
        edges: { color: '#000000', smooth: { type: 'continuous' } },
        nodes: {
          shape: 'dot',
          size: 16,
          font: { size: 14, color: '#000000' },
          borderWidth: 2,
        },
        physics: { enabled: true, barnesHut: { gravitationalConstant: -8000, springLength: 250 } },
      };

      if (networkInstance.current) {
        networkInstance.current.setData(data);
      } else {
        networkInstance.current = new Network(networkContainer.current, data, options);
      }
    }
  }, [triplets]);

  const modelUrl = "https://huggingface.co/Babelscape/rebel-large";
  const githubUrl = "https://github.com/thomaslim6793";

  return (
    <div className="app-container">
      <div className="input-section">
        <h2>Knowledge Graph Generator</h2>

        {/* Links below the heading, placed next to the text */}
        <div className="links-container">
          <p>
            All the credit for the KG model goes to: <a href={modelUrl} target="_blank" rel="noopener noreferrer">{modelUrl}</a>
          </p>
          <p>
            Connect with me: <a href={githubUrl} target="_blank" rel="noopener noreferrer">{githubUrl}</a>
          </p>
        </div>

        {/* Label for Text Input */}
        <label htmlFor="text-input">Text input</label>
        <textarea
          id="text-input"
          placeholder="Type or paste your text here..."
          value={inputText}
          onChange={handleInputChange}
          className={isDefault ? 'greyed-out' : ''} // Apply greyed-out style when it's default text
        ></textarea>

        {/* Show the warm-up spinner and text */}
        {warmingUp && (
          <div className="warming-up-container">
            <div className="spinner"></div>
            <div className="warming-up-text">Warming up the server, this will take only a moment...</div>
          </div>
        )}

        {/* Display the "Model is ready!" text when warm-up is complete and no inference is running */}
        {!warmingUp && !loading && (
          <div className="model-ready-text">Model is ready!</div>
        )}

        <button onClick={handleSubmit} disabled={loading || warmingUp}>
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

      {/* Graph Section */}
      <div className="graph-container">
        <div className="graph-section" ref={networkContainer}></div>
        <div className="graph-instructions">
          Click and drag to move the graph, scroll to zoom in/out.
        </div>
      </div>
    </div>
  );
}

export default App;