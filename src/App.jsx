import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Network } from 'vis-network';
import './App.css'; // Import the CSS file

function App() {
  const [inputText, setInputText] = useState('Barack Obama was born in Hawaii.'); // Example text input
  const [triplets, setTriplets] = useState([]); // Example triplet data
  const networkContainer = useRef(null);
  const networkInstance = useRef(null);

  // Function to submit the input text and fetch the triplets
  const handleSubmit = async () => {
    if (!inputText.trim()) {
      alert('Please enter some text.');
      return;
    }
    try {
      const response = await axios.post(`${import.meta.env.VITE_BACKEND_ENDPOINT}/generate`, {
        text: inputText,
      });
      setTriplets(response.data.triplets);
    } catch (error) {
      console.error('Error fetching triplets:', error);
      alert('An error occurred while processing your request.');
    }
  };

  // Automatically generate example knowledge graph when the component mounts
  useEffect(() => {
    const fetchExampleGraph = async () => {
      try {
        const response = await axios.post(`${import.meta.env.VITE_BACKEND_ENDPOINT}/generate`, {
          text: inputText,  // Use the default example text
        });
        setTriplets(response.data.triplets); // Set example triplet data
      } catch (error) {
        console.error('Error fetching example triplets:', error);
      }
    };

    // Call the function when the component mounts
    fetchExampleGraph();
  }, []); // Empty dependency array means this runs only once on component mount

  // Update the knowledge graph whenever triplets change
  useEffect(() => {
    if (triplets.length > 0 && networkContainer.current) {
      const nodes = [];
      const edges = [];
      
      // Convert triplets into nodes and edges for the knowledge graph
      triplets.forEach((triplet, index) => {
        const [subject, predicate, object] = triplet;
        nodes.push({ id: subject, label: subject });
        nodes.push({ id: object, label: object });
        edges.push({ from: subject, to: object, label: predicate });
      });

      const data = { nodes: new Set(nodes), edges };
      const options = {
        edges: { arrows: { to: { enabled: true } } },
        nodes: { shape: 'dot' },
      };

      // Create or update the knowledge graph
      if (networkInstance.current) {
        networkInstance.current.setData(data);
      } else {
        networkInstance.current = new Network(networkContainer.current, data, options);
      }
    }
  }, [triplets]);

  return (
    <div className="App">
      <h1>Knowledge Graph Generator</h1>
      <textarea
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Enter text to generate triplets..."
      />
      <button onClick={handleSubmit}>Generate Knowledge Graph</button>

      <div ref={networkContainer} style={{ height: '500px', border: '1px solid black', marginTop: '20px' }} />
    </div>
  );
}

export default App;