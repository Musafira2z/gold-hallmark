import React, { useRef, useState } from "react";
import PropTypes from "prop-types";
import userImg from "../assets/imageDefault.png";

const ProfileImageUploader = ({ onImageSelect }) => {
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
            setImage(e.target.result);
        };
        reader.readAsDataURL(file);

        if (onImageSelect) {
            console.log("File selected:", file);
            onImageSelect(file); // Pass the file to the parent
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

  return (
    <div className="flex flex-col w-full items-center justify-center space-y-5">
      {/* Clickable Profile Image */}
      <div
        className="w-48 h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg cursor-pointer overflow-hidden border-4 border-gray-200 hover:border-blue-400 transition-all duration-200 group"
        onClick={handleImageClick}
      >
        <img
          src={image}
          alt="Profile"
          className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-200"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
      
      {/* Hidden File Input */}
      <div className="flex flex-col items-center w-full max-w-sm">
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <div className="w-full flex gap-3">
          {/* Remove Button */}
          <button
            type="button"
            onClick={handleRemoveImage}
            className="flex-1 px-5 py-3 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-600 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md border border-gray-200 hover:border-red-300"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Remove
            </span>
          </button>

          {/* Open Camera Button */}
          <button
            type="button"
            onClick={handleOpenCamera}
            className="flex-1 px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg font-semibold transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Camera
            </span>
          </button>
        </div>
      </div>

      {/* Camera Modal */}
      {isCameraOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Capture Photo</h3>
              <button
                onClick={handleCloseCamera}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <video ref={videoRef} className="w-full h-64 bg-black rounded-lg mb-4" />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-3">
              <button
                onClick={handleCaptureImage}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Capture
                </span>
              </button>
              <button
                onClick={handleCloseCamera}
                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold transition-all duration-200 shadow-sm hover:shadow-md"
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
};

export default ProfileImageUploader;
