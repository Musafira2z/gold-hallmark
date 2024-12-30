import React from "react";

const DaySummary = () => {
  const services = [
    { name: "Xray", amount: 1200 },
    { name: "Hallmark", amount: 400 },
  ];

  const handleEdit = (index) => {
    console.log("Edit service at index:", index);
  };

  const handleDelete = (index) => {
    console.log("Delete service at index:", index);
  };

  const totalAmount = services.reduce((acc, service) => acc + service.amount, 0);

  return (
    <div className="p-10 bg-white rounded-lg shadow-md w-full mx-6 mt-10">
      <h2 className="text-xl font-bold text-green-700 mb-4">Day Summary</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead className="bg-green-100">
            <tr>
              <th className="border border-gray-200 py-2 px-4 text-left font-semibold">Service Name</th>
              <th className="border border-gray-200 py-2 px-4 text-left font-semibold">Total Amount</th>
              <th className="border border-gray-200 py-2 px-4 text-center font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map((service, index) => (
              <tr key={index} className="hover:bg-gray-100">
                <td className="border border-gray-200 py-2 px-4">{service.name}</td>
                <td className="border border-gray-200 py-2 px-4">{service.amount.toFixed(2)}</td>
                <td className="border border-gray-200 py-2 px-4 text-center">
                  <button
                    onClick={() => handleEdit(index)}
                    className="text-blue-500 hover:text-blue-700 mr-2"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
            <tr className="font-bold bg-gray-50">
              <td className="border border-gray-200 py-2 px-4">Total</td>
              <td className="border border-gray-200 py-2 px-4">{totalAmount.toFixed(2)}</td>
              <td className="border border-gray-200 py-2 px-4"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DaySummary;
