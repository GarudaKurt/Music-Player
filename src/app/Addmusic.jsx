import { useState } from "react";
import axios from "axios";
import '../App.css';

const Addmusic = () => {
  const [songName, setSongName] = useState('');
  const [songArtist, setSongArtist] = useState('');
  const [songFile, setSongFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!songName || !songArtist || !songFile) {
      alert("Please fill in all fields");
      return;
    }

    const formData = new FormData();
    formData.append("songName", songName);
    formData.append("songArtist", songArtist);
    formData.append("songFile", songFile);

    try {
      setUploading(true);
      await axios.post("http://localhost:5000/uploads", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      alert("Music uploaded successfully!");
      setSongName("");
      setSongArtist("");
      setSongFile(null);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload music.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="addmusic-container">
      <h2 className="addmusic-heading">🎵 Add New Music</h2>
      <form className="addmusic-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Song Name"
          value={songName}
          onChange={(e) => setSongName(e.target.value)}
          className="addmusic-input"
        />
        <input
          type="text"
          placeholder="Song Artist"
          value={songArtist}
          onChange={(e) => setSongArtist(e.target.value)}
          className="addmusic-input"
        />
        <input
          type="file"
          accept=".mp3"
          onChange={(e) => setSongFile(e.target.files[0])}
          className="addmusic-input"
        />
        <button type="submit" className="addmusic-button" disabled={uploading}>
          {uploading ? "Uploading..." : "Submit"}
        </button>
      </form>
    </div>
  );
};

export default Addmusic;
