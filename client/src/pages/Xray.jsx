import React, { useContext, useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import { CgRemove } from "react-icons/cg";
import { FaCamera } from "react-icons/fa";
import useItemNames from "../hooks/useItemNames.js";

const Xray = () => {
    const { customers } = useContext(UserContext);
    const [ordersData, setOrdersData] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("");
    const { itemOptions, loading: itemLoading, createItem } = useItemNames("xray");
    const [items, setItems] = useState([
        { item: "", quantity: "Quantity", rate: "Rate", weight: "Weight", amount: "", weightUnite: "gm", xray: "" }, // Initial item
    ]);
    const [formData, setFormData] = useState({
        name: "",
        customerID: "",
        company: "",
        item: "",
        type: "xray",
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

    const handleCreateItemOption = async (index, inputValue) => {
        const newOption = await createItem(inputValue);
        if (newOption) {
            handleItemChange(index, "item", newOption.value);
        }
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
        setItems([{ item: "", quantity: "", rate: "", weight: "", amount: "", weightUnite: "gm", xray: "" }]); // Reset the input form
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

    // Custom filter: 1-2 digits = Customer ID search, 3+ digits = Phone Number search
    // Handles both old users (contact as Number) and new users (contact as String)
    const filterOption = (option, inputValue) => {
        if (!inputValue || !inputValue.trim()) return true;
        
        const { contact, value } = option;
        const inputStr = inputValue.trim();
        
        // Extract only digits from input for comparison
        const inputDigits = inputStr.replace(/\D/g, '');
        const inputLength = inputDigits.length;
        
        if (inputLength === 0) return true;
        
        // Convert to strings and extract digits for comparison
        let customerIDStr = "";
        let phoneStr = "";
        
        // Handle Customer ID
        if (value !== null && value !== undefined && value !== "") {
            customerIDStr = String(value).replace(/\D/g, '');
        }
        
        // Handle Phone Number - can be Number (old users) or String (new users)
        if (contact !== null && contact !== undefined) {
            // Always convert to string first, regardless of type
            const contactStr = String(contact);
            
            // Extract digits from phone number - remove all non-digits
            if (contactStr && contactStr !== "" && contactStr !== "undefined" && contactStr !== "null") {
                phoneStr = contactStr.replace(/\D/g, '');
            }
        }
        
        // 1-2 digits: search in Customer ID only
        if (inputLength >= 1 && inputLength <= 2) {
            if (!customerIDStr) return false;
            const matches = customerIDStr.startsWith(inputDigits) || customerIDStr === inputDigits;
            return matches;
        }
        
        // 3+ digits: search in Phone Number only (works for both Number and String)
        if (inputLength >= 3) {
            if (!phoneStr || phoneStr.length === 0) return false;
            // Check if phone number starts with input or contains input
            const matches = phoneStr.startsWith(inputDigits) || phoneStr.includes(inputDigits);
            return matches;
        }
        
        return false;
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

        // Validate that at least one item is added
        if (allItems.length === 0 || allItems.flat().length === 0) {
            alert('Please add at least one product/item before submitting.');
            return;
        }

        // Validate that all items have required fields
        const hasValidItems = allItems.flat().some(item => 
            item.item && item.item !== "" && 
            item.quantity && item.quantity !== "" && 
            item.rate && item.rate !== ""
        );
        
        if (!hasValidItems) {
            alert('Please fill in all required product fields (Item, Quantity, Rate) before submitting.');
            return;
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

    const newOrderData = ordersData.filter((item) => item.type === "xray");

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
        <div className="min-h-screen">
            <div className="card-modern w-full">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        X-Ray Service
                    </h1>
                    <p className="text-gray-500">Create and manage X-Ray orders</p>
                </div>
                <form onSubmit={handleSubmit} onKeyDown={(e) => {
                    // Prevent form submission on Enter if no items are added
                    if (e.key === 'Enter') {
                        const allItems = [...addedItems];
                        if (items[0].item !== "" && items[0].quantity !== "" && items[0].rate !== "") {
                            allItems.push(items);
                        }
                        
                        // If no items added, prevent form submission
                        if (allItems.length === 0 || allItems.flat().length === 0) {
                            e.preventDefault();
                            return;
                        }
                        
                        // Check if Enter is pressed in customer selection fields
                        const target = e.target;
                        if (target.id === 'customerID' || target.id === 'name' || target.id === 'company' || target.closest('.css-1pahdxg-control') || target.closest('.css-1hwfws3')) {
                            e.preventDefault();
                            return;
                        }
                    }
                }}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card-modern bg-gradient-to-br from-gray-50 to-white" >
                            <div className="space-y-4 px-3 py-4">
                                <div className="mb-4">
                                    <label htmlFor="customerID" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Customer ID or Phone Number
                                    </label>
                                    <Select
                                        id="customerID"
                                        options={customerOptions}
                                        value={customerOptions.find(option => option.value === selectedCustomerId) || null}
                                        onChange={handleCustomerSelect}
                                        filterOption={filterOption}
                                        isClearable
                                        isSearchable
                                        placeholder="Search by ID or phone number..."
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                            }
                                        }}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Customer Name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        readOnly
                                        className="input-modern bg-gray-50"
                                        value={formData.name} // Display name based on selected ID
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Company
                                    </label>
                                    <select // Change to select dropdown
                                        id="company"
                                        className="w-full input-modern"
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
                                            <label htmlFor="item" className="block text-sm font-semibold text-gray-700 mb-2">Item Name</label>
                                            <CreatableSelect
                                                id={`xray-item-${index}`}
                                                className="w-full input-modern"
                                                value={item.item ? { value: item.item, label: item.item } : null}
                                                options={itemOptions}
                                                isClearable
                                                isLoading={itemLoading}
                                                onChange={(selectedOption) => handleItemChange(index, "item", selectedOption?.value || "")}
                                                onCreateOption={(inputValue) => handleCreateItemOption(index, inputValue)}
                                                placeholder="Select or add item..."
                                                formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
                                            />
                                        </div>
                                        <div className="flex gap-x-5">
                                            <div>
                                                <label htmlFor="item" className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
                                                <input
                                                    className="input-modern"
                                                    type="number"
                                                    placeholder="Quantity"
                                                    value={item.quantity}
                                                    data-field={`${index}-quantity`}
                                                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                                    onKeyPress={(e) => handleKeyPress(index, "quantity", e)}
                                                    onWheel={e => { e.target.blur(); e.preventDefault(); }} // Maximum scroll prevention
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="item" className="block text-sm font-semibold text-gray-700 mb-2">Rate (BDT)</label>
                                                <input
                                                    className="input-modern"
                                                    type="number"
                                                    placeholder="Rate"
                                                    value={item.rate}
                                                    data-field={`${index}-rate`}
                                                    onChange={(e) => handleItemChange(index, "rate", e.target.value)}
                                                    onKeyPress={(e) => handleKeyPress(index, "rate", e)}
                                                    onWheel={e => { e.target.blur(); e.preventDefault(); }} // Maximum scroll prevention
                                                />
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">  {/* Weight Input */}
                                            <div>
                                                <label htmlFor="item" className="block text-sm font-semibold text-gray-700 mb-2">Weight and Unit</label>
                                                <input
                                                    type="number"
                                                    className="w-2/3 input-modern"
                                                    placeholder="Weight"
                                                    value={item.weight}
                                                    data-field={`${index}-weight`}
                                                    onChange={(e) => handleItemChange(index, "weight", e.target.value)}
                                                    onKeyPress={(e) => handleKeyPress(index, "weight", e)}
                                                    onWheel={e => { e.target.blur(); e.preventDefault(); }} // Maximum scroll prevention
                                                />
                                            </div>
                                            <select
                                                className="w-1/3 input-modern"
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
                                            <label htmlFor="item" className="block text-sm font-semibold text-gray-700 mb-2">Total (BDT)</label>
                                            <input
                                                className="p-2"
                                                type="text"
                                                placeholder="Amount"
                                                value={item.amount}
                                                readOnly
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="item" className="block text-sm font-semibold text-gray-700 mb-2">
                                                Xray
                                            </label>
                                            <input
                                                id=""
                                                type="text"
                                                className="w-full input-modern"
                                                value={item.xray}
                                                data-field={`${index}-xray`}
                                                onChange={(e) => handleItemChange(index, "xray", e.target.value)}
                                                onKeyPress={(e) => handleKeyPress(index, "xray", e)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="btn-primary w-full" onClick={addItem}>
                                    Add Item
                                </button>
                            </div>
                        </div>
                        <div className="w-full space-y-5 card-modern">
                            <div className="space-y-4 items-list"> {/* Right Section - Table */}
                                <div className="table-modern">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Quantity</th>
                                            <th>Rate</th>
                                            <th>Weight</th>
                                            <th>Amount</th>
                                            <th>Delete</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {addedItems.flat().map((item, index) => ( // Display all added items
                                            <tr key={index}>
                                                <td>{item.item}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.rate}</td>
                                                <td>{item.weight} {item.weightUnite}</td>
                                                <td>{item.amount}</td>
                                                <td className="text-center">
                                                    <button className="text-red-500 hover:text-red-700 text-xl transition-colors" onClick={() => deleteItem(index)}>
                                                        <CgRemove />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="bg-gray-50 font-semibold">
                                            <td colSpan="4" className="text-right">Total:</td>
                                            <td className="text-blue-600">{totalAmount.toFixed(2)}</td>
                                            <td></td>
                                        </tr>
                                    </tbody>
                                </table>
                                </div>
                            </div>
                            <div className="flex flex-col gap-5">
                                <div>
                                    <label htmlFor="customerFrom" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Delivery Date
                                    </label>
                                    <input
                                        id="customerFrom"
                                        type="date"
                                        className="w-full input-modern"
                                        value={formData.customerFrom}
                                        onChange={handleInputChange}
                                        readOnly // Make it read-only so date is automatically captured
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="image" className="block text-sm font-semibold text-gray-700 mb-2">
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
                                            className="w-full input-modern"
                                            onChange={handleInputChange}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={openCamera}
                                        className="btn-secondary w-full lg:w-1/2 my-3 flex text-center justify-center items-center gap-2"
                                    >
                                        <FaCamera />
                                        Open Camera
                                    </button>
                                </div>
                            </div>
                            <div>
                                <button type="submit" className="btn-primary w-full lg:w-auto">
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

export default Xray;
