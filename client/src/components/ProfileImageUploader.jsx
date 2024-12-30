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

  return (
    <div className="flex flex-col w-1/3 items-center justify-center space-y-4 mt-6 sm:mt-0">
      {/* Clickable Profile Image */}
      <div
        className="w-44 h-44 bg-gray-200 rounded-full flex items-center justify-center shadow-md cursor-pointer overflow-hidden"
        onClick={handleImageClick}
      >
        <img
          src={image}
          alt="Profile"
          className="w-full h-full object-cover rounded-full"
        />
      </div>
      {/* Hidden File Input */}
      <div className="flex flex-col items-center">
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
            className="px-4 py-2 bg-[#6eb8ac] text-white rounded-lg hover:bg-red-100 hover:text-red-600"
          >
            Remove
          </button>

          {/* Open Camera Button */}
          <button
            type="button"
            onClick={handleOpenCamera}
            className="w-full px-4 py-2 bg-[#004D40] text-white rounded-lg hover:bg-[#00332E]"
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

            <div className="mt-4 flex justify-between">
              <button
                onClick={handleCaptureImage}
                className="px-4 py-2 bg-green-500 text-white rounded-lg shadow hover:bg-green-700"
              >
                Capture
              </button>
              <button
                onClick={handleCloseCamera}
                className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-700"
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
