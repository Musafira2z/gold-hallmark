import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import userImg from "../assets/imageDefault.png";

const ProfileImageUploader = ({ onImageSelect, compact = false }) => {
  const fileInputRef = useRef(null);
  const [image, setImage] = useState(userImg); // Default placeholder image
  const [isCameraOpen, setIsCameraOpen] = useState(false); // State to toggle camera
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Trigger file input on image click
  const handleImageClick = () => {
    fileInputRef.current.click();
  };

  // Handle file input change
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImage(e.target.result); // Update state with the selected image's data URL
      };
      reader.readAsDataURL(file);

      // Pass the selected file to the parent component
      if (onImageSelect) {
        onImageSelect(file);
      }
    }
  };

  // Handle image removal
  const handleRemoveImage = () => {
    setImage(userImg); // Reset to placeholder image
    if (onImageSelect) {
      onImageSelect(null); // Notify parent that image is removed
    }
  };

  // Open camera
  const handleOpenCamera = async () => {
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
    }
  };

  // Capture image from video
  const handleCaptureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const capturedImage = canvas.toDataURL("image/png");
    setImage(capturedImage);
    if (onImageSelect) {
      // Convert the captured image to a Blob and pass it to the parent
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], "captured-image.png", { type: "image/png" });
          onImageSelect(file);
        });
    }

    // Stop camera
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach((track) => track.stop());

    setIsCameraOpen(false);
  };

  // Cancel camera capture
  const handleCloseCamera = () => {
    const stream = videoRef.current.srcObject;
    if (stream) {
      const tracks = stream.getTracks();
      tracks.forEach((track) => track.stop());
    }
    setIsCameraOpen(false);
  };

  // Compact mode for inline display
  if (compact) {
    return (
      <div className="flex items-center w-full gap-3">
        {/* Small Profile Image */}
        <div
          className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center cursor-pointer overflow-hidden border-2 border-gray-300 hover:border-blue-400 transition-all flex-shrink-0"
          onClick={handleImageClick}
        >
          <img
            src={image}
            alt="Profile"
            className="w-full h-full object-cover rounded-full"
          />
        </div>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="flex gap-2 flex-1">
          <button
            type="button"
            onClick={handleImageClick}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all duration-200 text-sm font-medium"
          >
            Upload
          </button>
          <button
            type="button"
            onClick={handleOpenCamera}
            className="flex-1 px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 text-sm font-medium"
          >
            Camera
          </button>
        </div>

        {/* Camera Modal */}
        {isCameraOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="relative bg-white p-4 rounded-lg">
              <video ref={videoRef} className="w-64 h-48 bg-black rounded-lg" />
              <canvas ref={canvasRef} className="hidden" />

              <div className="mt-4 flex justify-between gap-4">
                <button
                  onClick={handleCaptureImage}
                  className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium"
                >
                  Capture
                </button>
                <button
                  onClick={handleCloseCamera}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg shadow-md hover:bg-gray-600 transition-all duration-200 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full size mode (original)
  return (
    <div className="flex flex-col w-full items-center justify-center space-y-6">
      {/* Clickable Profile Image */}
      <div
        className="w-48 h-48 bg-gray-200 rounded-full flex items-center justify-center shadow-lg cursor-pointer overflow-hidden border-4 border-gray-300 hover:border-blue-400 transition-all"
        onClick={handleImageClick}
      >
        <img
          src={image}
          alt="Profile"
          className="w-full h-full object-cover rounded-full"
        />
      </div>
      {/* Hidden File Input */}
      <div className="flex flex-col items-center w-full max-w-md">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="w-full flex gap-4">
          {/* Remove Button */}
          <button
            type="button"
            onClick={handleRemoveImage}
            className="flex-1 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            Remove
          </button>

          {/* Open Camera Button */}
          <button
            type="button"
            onClick={handleOpenCamera}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
          >
            Camera
          </button>
        </div>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="relative bg-white p-4 rounded-lg">
            <video ref={videoRef} className="w-64 h-48 bg-black rounded-lg" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="mt-4 flex justify-between gap-4">
              <button
                onClick={handleCaptureImage}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg shadow-md hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-medium"
              >
                Capture
              </button>
              <button
                onClick={handleCloseCamera}
                className="px-6 py-2 bg-gray-500 text-white rounded-lg shadow-md hover:bg-gray-600 transition-all duration-200 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ProfileImageUploader.propTypes = {
  onImageSelect: PropTypes.func, // Callback to pass the selected image file to parent
  compact: PropTypes.bool, // If true, renders a compact inline version
};

export default ProfileImageUploader;
