import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Select from "react-select"; // Import react-select
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import { CgRemove } from "react-icons/cg";
import { FaCamera } from "react-icons/fa";

const Hallmark = () => {
    const { customers } = useContext(UserContext);
    const [ordersData, setOrdersData] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("");
    const itemNames = [
        "Ayesti",
        "Aungty",
        "Baju",
        "Bala",
        "Bangle",
        "Bicha",
        "Bracelet",
        "Buttam",
        "Bati",
        "Bauti",
        "Chain",
        "Chik",
        "Chur",
        "Churi",
        "Chamus",
        "Chandi-Rupa",
        "Center piss",
        "Court pin",
        "Dul",
        "Earring pair",
        "Ghaar tana pair",
        "Glass",
        "Gold",
        "Haar",
        "Hair chain pair",
        "Hath panja",
        "Jhapta",
        "Jumka pair",
        "Kaan tana pair",
        "Kankon",
        "Konhkon",
        "Key",
        "Kontho chik",
        "Locket",
        "Locket & chain",
        "Mangalsutra",
        "Mantasha",
        "Medal",
        "Madli",
        "Mukut",
        "Necklace",
        "Nose pin",
        "Noth",
        "Nupur",
        "Pasha pair",
        "Payel",
        "Pola",
        "Plate",
        "Ring",
        "Ball ring",
        "Ratan chur",
        "Shakha",
        "Side clip",
        "Sita haar",
        "Sithi patti",
        "Silver",
        "Spcial item",
        "Shakha piss",
        "Sui suta",
        "Tikly",
        "Taj",
        "Tabic,",
        "Tip",
        "Zoroa haar"
    ];
    const [items, setItems] = useState([
        { item: "", quantity: "Quantity", rate: "Rate", weight: "Weight", amount: "", weightUnite: "gm", xray: "" }, // Initial item
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
        customerFrom: new Date().toISOString().split('T')[0], // Set current date automatically
        image: null,
        contact: "",
        address: "",
    });
    const [addedItems, setAddedItems] = useState([]);
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
            setTotalAmount(calculateTotal(addedItems.flat().concat(newItems)));
            return newItems;
        });
    };

    // Handle keyboard navigation for item fields
    const handleKeyPress = (index, field, e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            
            // Define the field order for navigation
            const fieldOrder = ['quantity', 'weight', 'rate', 'xray'];
            const currentFieldIndex = fieldOrder.indexOf(field);
            
            if (currentFieldIndex < fieldOrder.length - 1) {
                // Move to next field
                const nextField = fieldOrder[currentFieldIndex + 1];
                const nextInput = document.querySelector(`input[data-field="${index}-${nextField}"]`);
                if (nextInput) {
                    nextInput.focus();
                }
            } else {
                // Last field - add item to list
                const currentItem = items[index];
                if (currentItem.item && currentItem.quantity && currentItem.rate) {
                    addItem();
                    // Focus on the first field of the new item
                    setTimeout(() => {
                        const newItemInput = document.querySelector(`input[data-field="${index + 1}-quantity"]`);
                        if (newItemInput) {
                            newItemInput.focus();
                        }
                    }, 100);
                }
            }
        }
    };

    const addItem = () => {
        const newItem = items.map((item) => ({ ...item })); // Create a copy of the current items
        setAddedItems([...addedItems, newItem]); // Add the copied items to addedItems
        
        // Keep the item name but reset other fields
        const currentItemName = items[0].item;
        setItems([{ 
            item: currentItemName, // Keep the selected item name
            quantity: "", 
            rate: "", 
            weight: "", 
            amount: "", 
            weightUnite: "gm", 
            xray: "" 
        }]); // Reset the input form but keep item name
        setTotalAmount(calculateTotal(addedItems.flat().concat(newItem)));
    };
    const deleteItem = (index) => {
        setAddedItems((prevItems) => {
            const newItems = [...prevItems];
            newItems.splice(index, 1); // Remove item at `index` position
            setTotalAmount(calculateTotal(newItems)); // Recalculate the total
            return newItems;
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
            setCapturedImage(URL.createObjectURL(files));
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

    // Create options for react-select with both ID and phone
    const customerOptions = customers.map((customer) => ({
        value: customer.customerID,
        label: `${customer.customerID} (${customer.contact})`,
        contact: customer.contact,
    }));

    // Custom filter to allow searching by ID or phone
    const filterOption = (option, inputValue) => {
        const { label, contact, value } = option;
        const valueStr = value ? String(value).toLowerCase() : "";
        const contactStr = contact ? String(contact).toLowerCase() : "";
        const labelStr = label ? String(label).toLowerCase() : "";
        const inputStr = inputValue ? inputValue.toLowerCase() : "";

        return (
            labelStr.includes(inputStr) ||
            contactStr.includes(inputStr) ||
            valueStr.includes(inputStr)
        );
    };

    const handleCustomerSelect = (selectedOption) => {
        if (!selectedOption) {
            setSelectedCustomerId("");
            setFormData({ ...formData, customerID: "", name: "", company: "", contact: "", address: "" });
            return;
        }
        setSelectedCustomerId(selectedOption.value);
        const selectedCustomer = customers.find(
            (customer) => customer.customerID === selectedOption.value
        );
        if (selectedCustomer) {
            const initialCompany = selectedCustomer.company.length > 0 ? selectedCustomer.company[0] : "";
            setSelectedCompany(initialCompany);
            setFormData({
                ...formData,
                customerID: selectedCustomer.customerID,
                name: selectedCustomer.name,
                company: initialCompany,
                contact: selectedCustomer.contact,
                address: selectedCustomer.address,
            });
        }
    };

    const calculateTotal = (allItems) => {
        return allItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    }

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        const allItems = [...addedItems];
        // Check whether the fields are not empty before pushing them into `allItems`
        if (items[0].item !== "" && items[0].quantity !== "" && items[0].rate !== "") {
            allItems.push(items);
        }

        const calculatedTotalAmount = totalAmount;
        const data = new FormData();
        Object.keys(formData).forEach((key) => {
            if (formData[key]) {
                data.append(key, formData[key]);
            }
        });

        data.append("items", JSON.stringify(allItems.flat()));
        data.append("totalAmount", calculatedTotalAmount);

        // Append the random voucher number
        const voucher = generateVoucher();
        data.append("voucher", voucher);
        try {
            const response = await axios.post(`${apiUrl}/orders`, data, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            setOrdersData((prevData) => [...prevData, response.data]);

            // Only reset item-related fields and image, keep customer info and delivery date
            setImageName(""); // Reset image name after submission
            setCapturedImage(null); // Reset captured image
            setAddedItems([]); // Clear added items after successful submission
            setItems([{ item: "", quantity: "", rate: "", weight: "", amount: "", weightUnite: "gm", xray: "" }]); // Reset items state but keep structure
            setTotalAmount(0);
            
            // Reset only the image field in formData, keep everything else
            setFormData(prevData => ({
                ...prevData,
                image: null
            }));

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

    const newOrderData = ordersData.filter((item) => item.type === "hallmark");

    const handleCompanyChange = (event) => {
        setSelectedCompany(event.target.value);
        setFormData({
            ...formData,
            company: event.target.value,
        });
    };

    // Open the camera modal
    const openCamera = () => {
        setIsModalOpen(true);
        navigator.mediaDevices.getUserMedia({ video: true }, { aspectRatio: 1.777777778 })
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
                <h1 className="text-2xl font-semibold text-[#004D40] mb-6">Hallmark</h1>
                <form onSubmit={handleSubmit}>
                    <div className="flex flex-col lg:flex-row gap-10">
                        <div className="border border-gray-100 shadow-sm p-3" >
                            <div className="space-y-4 px-3 py-4">
                                <div className="mb-4">
                                    <label htmlFor="customerID" className="block text-[#004D40] font-bold mb-1">
                                        Customer ID or Phone Number
                                    </label>
                                    <Select
                                        id="customerID"
                                        options={customerOptions}
                                        value={customerOptions.find(option => option.value === selectedCustomerId) || null}
                                        onChange={handleCustomerSelect}
                                        filterOption={filterOption}
                                        isClearable
                                        placeholder="Search by ID or phone number..."
                                    />
                                </div>
                                <div>
                                    <label htmlFor="name" className="block text-[#004D40] font-bold mb-1">
                                        Customer Name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        readOnly
                                        className="w-full border-b border-gray-300 p-2 text-[#004D40]"
                                        value={formData.name} // Display name based on selected ID
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company" className="block text-[#004D40] font-bold mb-1">
                                        Company
                                    </label>
                                    <select // Change to select dropdown
                                        id="company"
                                        className="w-full border-b border-gray-300 p-2"
                                        value={selectedCompany}
                                        onChange={handleCompanyChange}
                                    >
                                        {customers.find((customer) => customer.customerID === selectedCustomerId)?.company.map((companyName) => (
                                            <option key={companyName} value={companyName}>
                                                {companyName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                            </div>

                            {/* Middle Section */}
                            <div className="space-y-10 mb-6">
                                {items.map((item, index) => (
                                    <div key={index} className="flex  flex-col gap-y-3 p-2 rounded">
                                        <div>
                                            <label htmlFor="item" className="block text-[#004D40] font-bold mb">Item Name</label>
                                            <Select
                                                options={itemNames.map(name => ({ value: name, label: name }))}
                                                id="item"
                                                className="w-full border-b border-gray-300 p-2"
                                                onChange={(selectedOption) => handleItemChange(index, "item", selectedOption.value)}
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
                                                    data-field={`${index}-quantity`}
                                                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                                    onKeyPress={(e) => handleKeyPress(index, "quantity", e)}
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="item" className="block text-[#004D40] font-bold mb">Rate (BDT)</label>
                                                <input
                                                    className="border-b border-gray-300 p-2"
                                                    type="number"
                                                    placeholder="Rate"
                                                    value={item.rate}
                                                    data-field={`${index}-rate`}
                                                    onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                                                    onKeyPress={(e) => handleKeyPress(index, "rate", e)}
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
                                                    data-field={`${index}-weight`}
                                                    onChange={(e) => handleItemChange(index, "weight", e.target.value)}
                                                    onKeyPress={(e) => handleKeyPress(index, "weight", e)}
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
                                                className="p-2"
                                                type="text"
                                                placeholder="Amount"
                                                value={item.amount}
                                                readOnly
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="item" className="block text-[#004D40] font-bold mb-1">
                                                Hallmark
                                            </label>
                                            <input
                                                id=""
                                                type="text"
                                                className="w-full border-b border-gray-300 p-2"
                                                value={item.xray}
                                                data-field={`${index}-xray`}
                                                onChange={(e) => handleItemChange(index, "xray", e.target.value)}
                                                onKeyPress={(e) => handleKeyPress(index, "xray", e)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="w-full px-3 py-2 text-white bg-[#004D40] border-[#004D40] rounded-lg" onClick={addItem}>
                                    Add Item
                                </button>
                            </div>
                        </div>
                        <div className="w-full space-y-5 border border-gray-100 shadow-sm p-3">
                            <div className="space-y-4 items-list"> {/* Right Section - Table */}
                                <table className="w-full border-collapse">
                                    <thead>
                                        <tr>
                                            <th className="border p-2">Item</th>
                                            <th className="border p-2">Quantity</th>
                                            <th className="border p-2">Rate</th>
                                            <th className="border p-2">Weight</th>
                                            <th className="border p-2">Amount</th>
                                            <th className="border p-2">Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {addedItems.flat().map((item, index) => ( // Display all added items
                                            <tr key={index}>
                                                <td className="border p-2">{item.item}</td>
                                                <td className="border p-2">{item.quantity}</td>
                                                <td className="border p-2">{item.rate}</td>
                                                <td className="border p-2">{item.weight} {item.weightUnite}</td>
                                                <td className="border p-2">{item.amount}</td>
                                                <td className="border p-2 text-center">
                                                    <button className="text-red-600 text-xl" onClick={() => deleteItem(index)}>
                                                        <CgRemove />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr>
                                            <td htmlFor="totalAmount" colSpan="4" className="border p-2 text-right font-bold">Total:</td>
                                            <td id="totalAmount" className="border p-2 font-bold">{totalAmount.toFixed(2)}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex flex-col gap-5">
                                <div>
                                    <label htmlFor="customerFrom" className="block text-[#004D40] font-bold">
                                        Delivery Date                                    </label>
                                    <input
                                        id="customerFrom"
                                        type="date"
                                        className="w-full border-b border-gray-300 p-2"
                                        value={formData.customerFrom}
                                        onChange={handleInputChange}
                                        readOnly // Make it read-only so date is automatically captured
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="image" className="block text-[#004D40] font-bold ">
                                        Upload Image
                                    </label>
                                    {capturedImage && (
                                        <div className="mb-2 text-green-500">
                                            {/* Image: {imageName} */}
                                            <img src={capturedImage} alt={imageName} className="my-4 max-h-36" /> {/* Add margin and max height */}
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
                                        className="w-full lg:w-1/2 px-3 py-2 text-white bg-[#004D40] border-[#004D40] rounded-lg my-3 flex text-center justify-center items-center gap-2"
                                    >
                                        <FaCamera/>
                                        Open Camera
                                    </button>
                                </div>
                            </div>
                            <div>
                                <button type="submit" className="bg-[#004D40] text-white py-2 px-4 rounded-lg">
                                    Submit & Print
                                </button>
                            </div>
                        </div>
                    </div>
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
                                style={{ aspectRatio: '16/9' }}
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
            </div>
        </div>
    );
};

export default Hallmark;
