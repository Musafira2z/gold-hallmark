import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Select from "react-select"; // Import react-select
import OrderDetailPage from "../components/OrderDetailsPag";
import { apiUrl, UserContext } from "../context/UserContext.jsx";

const Xray = () => {
    const { customers } = useContext(UserContext);
    const [ordersData, setOrdersData] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0); 
    const [items, setItems] = useState([
        { item: "", quantity: 0, rate: 0, weight: 0, amount: 0, weightUnite: "gm" }, // Initial item
    ]);
    const [formData, setFormData] = useState({
        name: "",
        customerID: "",
        company: "",
        item: "",
        type: "hallmark",
        quantity: "",
        weight: "",
        weightUnite: "gm",
        rate: "",
        amount: "",
        xray: "",
        customerFrom: "",
        image: null,
        contact: "",
        address: "",
    });

    const [isModalOpen, setIsModalOpen] = useState(false); // Modal state for camera
    const [cameraStream, setCameraStream] = useState(null); // To store camera stream
    const [capturedImage, setCapturedImage] = useState(null); // To store captured image
    const [imageName, setImageName] = useState(""); // To store image name

    const navigate = useNavigate();

    const generateVoucher = () => {
        return Math.floor(100000 + Math.random() * 900000).toString(); // Generates a 6-digit number
    };
    const handleItemChange = (index, field, value) => {
        setItems((prevItems) => {
            const newItems = [...prevItems];
            newItems[index] = { ...newItems[index], [field]: value };

            // Calculate amount when quantity or rate changes
            if (field === "quantity" || field === "rate") {
                newItems[index].amount = (parseFloat(newItems[index].quantity) * parseFloat(newItems[index].rate) || 0).toFixed(2);
            }
            const newTotalAmount = newItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
            setTotalAmount(newTotalAmount); // Update total amount state
            setFormData(prevData => ({ ...prevData, amount: newTotalAmount }));
            return newItems;
        });
    };
    const addItem = () => {
        setItems((prevItems) => {
            const newItems = [
                ...prevItems,
                { item: "", quantity: 0, rate: 0, weight: 0, amount: 0, weightUnite: "gm" },
            ];
            const newTotalAmount = newItems.reduce((sum, item) => sum + parseFloat(item.amount), 0);
            setTotalAmount(newTotalAmount); // Update total amount state
            setFormData(prevData => ({ ...prevData, amount: newTotalAmount }));
            return newItems
        });
    };
    // Handle form input change
    const handleInputChange = (e) => {
        const { id, value, files } = e.target;

        if (id === "image") {
            setFormData((prevData) => ({
                ...prevData,
                image: files[0],
            }));
            setImageName(files[0].name); // Set image name
        } else if (id === "quantity" || id === "rate") {
            const parsedValue = parseFloat(value) || 0;
            setFormData((prevData) => {
                const newData = { ...prevData, [id]: parsedValue };
                if (newData.quantity && newData.rate) {
                    newData.amount = (parseFloat(newData.quantity) * parseFloat(newData.rate)).toFixed(2);
                }
                return newData;
            });
        } else {
            setFormData((prevData) => ({
                ...prevData,
                [id]: value,
            }));
        }
    };

    // Handle customer selection from the dropdown
    const handleCustomerChange = (selectedOption) => {
        const selectedCustomer = customers.find((customer) => customer._id === selectedOption.value);
        if (selectedCustomer) {
            setFormData((prevData) => ({
                ...prevData,
                customerID: selectedCustomer.customerID,
                name: selectedCustomer.name,
                company: selectedCustomer.company.join(", "), // Convert array to string
                contact: selectedCustomer.contact,
                address: selectedCustomer.address,
            }));
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        const data = new FormData();
        Object.keys(formData).forEach((key) => {
            if (formData[key]) {
                data.append(key, formData[key]);
            }
        });
        data.append("items", JSON.stringify(items));
        // Append the random voucher number
        const voucher = generateVoucher();
        data.append("voucher", voucher);
        // Calculate total amount
        const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.amount), 0);
        data.append("totalAmount", totalAmount);

        try {
            const response = await axios.post(`${apiUrl}/orders`, data, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            setOrdersData((prevData) => [...prevData, response.data]);

            // Reset form data after successful submission
            setFormData({
                name: "",
                customerID: "",
                company: "",
                item: "",
                quantity: "",
                weight: "",
                weightUnite: "gm",
                rate: "",
                amount: "",
                xray: "",
                customerFrom: "",
                image: null,
                contact: "",
                address: "",
            });
            setImageName(""); // Reset image name after submission
            const invoiceUrl = `/invoice/${response.data._id}`;
            const newTab = window.open(invoiceUrl, "_blank");

            if (!newTab) {
                alert("Failed to open new tab. Please allow popups for this site.");
            }
        } catch (error) {
            console.error("Error uploading data:", error);
        }
    };


    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const response = await axios.get(`${apiUrl}/orders`);
                setOrdersData(response.data || []);
            } catch (error) {
                console.error("Error fetching X-ray data:", error);
            }
        };
        fetchOrderData();
    }, []);

    const newOrderData = ordersData.filter((item) => item.type === "xray");

    const customerOptions = customers?.map((customer) => ({
        value: customer._id,
        label: customer.name,
    }));

    // Open the camera modal
    const openCamera = () => {
        setIsModalOpen(true);
        navigator.mediaDevices.getUserMedia({ video: true })
            .then((stream) => {
                setCameraStream(stream);
            })
            .catch((err) => console.error("Error accessing camera: ", err));
    };

    // Close the camera modal and stop the camera
    const closeCamera = () => {
        if (cameraStream) {
            const tracks = cameraStream.getTracks();
            tracks.forEach(track => track.stop());
        }
        setIsModalOpen(false);
    };

    // Capture image from the camera
    const captureImage = () => {
        const video = document.getElementById("camera-video");
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert canvas data to Blob
        canvas.toBlob((blob) => {
            const file = new File([blob], "captured-image.png", { type: "image/png" });
            setCapturedImage(URL.createObjectURL(blob)); // Show preview if needed
            setImageName("captured-image.png"); // Set the file name
            setFormData((prevData) => ({
                ...prevData,
                image: file, // Save as a File object in formData
            }));
        }, "image/png");

        closeCamera();
    };


    return (
        <div className="min-h-screen p-6 flex justify-center">
            <div className="bg-white p-8 rounded-lg shadow-md w-full mt-6">
                <h1 className="text-2xl font-semibold text-[#004D40] mb-6">Xray</h1>
                <form onSubmit={handleSubmit}>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Left Section */}
                        <div className="space-y-4 border px-3 py-4">
                            <div className="mb-2">
                                <label htmlFor="name" className="block text-[#004D40] font-bold mb-1">
                                    Customer Name
                                </label>
                                <Select
                                    options={customerOptions}
                                    onChange={handleCustomerChange}
                                    placeholder="Select a customer"
                                    className="w-full"
                                />
                            </div>
                            <div>
                                <label htmlFor="customerID" className="block text-[#004D40] font-bold mb-1">
                                    Customer ID
                                </label>
                                <input
                                    id="customerID"
                                    type="text"
                                    readOnly
                                    className="w-full border-b border-gray-300 p-2 text-[#004D40]"
                                    value={formData.customerID}
                                />
                            </div>
                            <div>
                                <label htmlFor="company" className="block text-[#004D40] font-bold mb-1">
                                    Company Name
                                </label>
                                <input
                                    id="company"
                                    type="text"
                                    readOnly
                                    className="w-full border-b border-gray-300 p-2 text-[#004D40]"
                                    value={formData.company}
                                />
                            </div>

                        </div>

                        {/* Middle Section */}
                        <div className="space-y-10">
                            {items.map((item, index) => (
                                <div key={index} className="flex  flex-col gap-y-3 border p-2 rounded">
                                    <div>
                                        <label htmlFor="item" className="block text-[#004D40] font-bold mb">Item Name</label>
                                        <input
                                            className="w-full border-b border-gray-300 p-2"
                                            type="text"
                                            placeholder="Your Name"
                                            value={item.item}
                                            onChange={(e) => handleItemChange(index, "item", e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-x-5">
                                        <div>
                                            <label htmlFor="item" className="block text-[#004D40] font-bold mb">Quantity</label>
                                            <input
                                                className="border-b border-gray-300 p-2"
                                                type="number"
                                                placeholder="Quantity"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="item" className="block text-[#004D40] font-bold mb">Rate (BDT)</label>
                                            <input
                                                className="border-b border-gray-300 p-2"
                                                type="number"
                                                placeholder="Rate"
                                                value={item.rate}
                                                onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="flex space-x-2">  {/* Weight Input */}
                                        <div>
                                            <label htmlFor="item" className="block text-[#004D40] font-bold mb">Weight and Unite</label>
                                            <input
                                                type="number"
                                                className="w-2/3 border-b border-gray-300 p-2"
                                                placeholder="Weight"
                                                value={item.weight}
                                                onChange={(e) => handleItemChange(index, "weight", e.target.value)}
                                            />
                                        </div>
                                        <select
                                            className="w-1/3 border-b border-gray-300 p-2"
                                            value={item.weightUnite}
                                            onChange={(e) => handleItemChange(index, "weightUnite", e.target.value)}
                                        >
                                            <option value="gm">gm</option>
                                            <option value="ana">ana</option>
                                            <option value="point">point</option>
                                            <option value="vori/tola">vori/tola</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label htmlFor="item" className="block text-[#004D40] font-bold mb">Total (BDT)</label>
                                        <input
                                            className=""
                                            type="text"
                                            placeholder="Amount"
                                            value={item.amount}
                                            readOnly
                                        />
                                    </div>
                                </div>
                            ))}
                            <button type="button" className="px-3 py-2 border border-[#004D40] rounded-lg hover:bg-[#004D40] hover:text-white" onClick={addItem}>
                                Add Another Item
                            </button>
                        </div>
                        {/* Right Section */}
                        <div className="space-y-4 border px-3 py-4">
                            <div className="">
                                <label htmlFor="totalAmount" className="block text-[#004D40] font-bold">
                                    Total Amount(BDT)
                                </label>
                                <input
                                    id="totalAmount"
                                    type="text"
                                    readOnly
                                    className="w-full border-b border-gray-300 p-2 text-[#004D40]"
                                    placeholder="0"
                                    value={totalAmount}
                                />
                            </div>
                            <div>
                                <label htmlFor="xray" className="block text-[#004D40] font-bold mb-1">
                                    Xray
                                </label>
                                <input
                                    id="xray"
                                    type="text"
                                    className="w-full border-b border-gray-300 p-2"
                                    value={formData.xray}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="customerFrom" className="block text-[#004D40] font-bold">
                                    Customer From
                                </label>
                                <input
                                    id="customerFrom"
                                    type="date"
                                    className="w-full border-b border-gray-300 p-2"
                                    value={formData.customerFrom}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="image" className="block text-[#004D40] font-bold ">
                                    Upload Image
                                </label>
                                {capturedImage && (
                                    <div className="mb-2 text-green-500">
                                        Image: {imageName}
                                    </div>
                                )}
                                {!capturedImage && (
                                    <input
                                        id="image"
                                        type="file"
                                        className="w-full border-b border-gray-300 p-2"
                                        onChange={handleInputChange}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={openCamera}
                                    className="w-full border border-[#004D40] text-[#004D40] p-2 mt-2 rounded-lg hover:bg-[#004D40] hover:text-white transition-all ease-in-out"
                                >
                                    Open Camera
                                </button>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="mt-6 bg-[#004D40] text-white py-2 px-4 rounded-lg"
                    >
                        Submit & Print
                    </button>
                </form>

                {isModalOpen && (
                    <div
                        className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-10">
                        <div className="bg-white p-4 rounded-md">
                            <h2 className="text-lg font-semibold mb-4">Capture Image</h2>
                            <video
                                id="camera-video"
                                width="100%"
                                height="auto"
                                autoPlay
                                playsInline
                                ref={(video) => video && (video.srcObject = cameraStream)}
                            ></video>
                            <div className="mt-4 flex justify-center">
                                <button
                                    onClick={captureImage}
                                    className="bg-blue-500 text-white px-4 py-2 rounded mr-2"
                                >
                                    Capture
                                </button>
                                <button
                                    onClick={closeCamera}
                                    className="bg-gray-500 text-white px-4 py-2 rounded"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="border-2 border-[#004D40] p-4 mt-6 rounded-lg">
                    {/* <XrayDetailsTable ordersData={newOrderData} /> */}
                    <OrderDetailPage newOrderData={newOrderData} title="Xray"/>
                </div>
            </div>
        </div>
    );
};

export default Xray;
