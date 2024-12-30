import React, { useState } from "react";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import PropTypes from "prop-types";

const TABLE_HEAD = ["CustomerID", "Item", "Weight", "Quantity", "Amount", "Date"];

const OrderDetailPage = ({ newOrderData }) => {
  const [searchQuery, setSearchQuery] = useState(""); // State for the search input
  const [currentPage, setCurrentPage] = useState(1); // Current page state
  const itemsPerPage = 5; // Items per page

  // Filter the data based on the search query (customer name and company)
  const filteredData = newOrderData.filter(({ name, company }) => {
    const lowerSearchQuery = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(lowerSearchQuery) ||
      company.toLowerCase().includes(lowerSearchQuery)
    );
  });

  // Paginate the filtered data
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // Reset to first page on search change
  };

  // Handle page change (next and previous)
  const handlePageChange = (page) => {
    if (page > 0 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const totalPages = Math.ceil(filteredData.length / itemsPerPage); // Total number of pages

  return (
    <Card className="h-full w-full"  id='printablediv'> 
      <CardBody className="overflow-scroll px-4">
        <div className="pb-4 pt-2">
          <h2 className="text-2xl text-[#004D40] font-semibold">
            Order Details of Hallmark Data.
          </h2>
        </div>
        <div className="w-full mb-4">
          <label htmlFor="search" className="block mb-2 text-[#004D40]">Search</label>
          <input
            className="w-full p-2 border rounded-lg border-[#004D40]"
            type="text"
            placeholder="Search by Customer or Company"
            value={searchQuery}
            onChange={handleSearchChange} // Call handleSearchChange on input change
          />
        </div>
        <table className="mt-4 w-full min-w-max table-auto text-left">
          <thead>
            <tr>
              {TABLE_HEAD.map((head) => (
                <th
                  key={head}
                  className="border-y  text-[#004D40] border-[#004D40] p-4"
                >
                  <Typography
                    variant="small"
                    color="blue-gray"
                    className="opacity-100 text-[#004D40] font-semibold"
                  >
                    {head}
                  </Typography>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {currentItems.map(
              ({ customerID, name, company, item, weight, quantity,weightUnite, amount, customerFrom }, index) => {
                const isLast = index === currentItems.length - 1;
                const classes = isLast ? "p-4" : "p-4 border-b border-[#004D40]";
                return (
                  <tr key={index}>
                    <td className={classes}>
                      <div className="flex flex-col">
                        <Typography variant="small" color="blue-gray" className="font-normal">
                          {name}
                        </Typography>
                        <Typography variant="small" color="blue-gray" className="font-normal opacity-70">
                          {company}
                        </Typography>
                      </div>
                    </td>
                    <td className={classes}>
                      <Typography variant="small" color="blue-gray" className="font-normal">
                        {item}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography variant="small" color="blue-gray" className="font-normal">
                        {weight} {weightUnite}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography variant="small" color="blue-gray" className="font-normal">
                        {quantity}
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography variant="small" color="blue-gray" className="font-normal">
                        {amount} Tk
                      </Typography>
                    </td>
                    <td className={classes}>
                      <Typography variant="small" color="blue-gray" className="font-normal">
                        {new Date(customerFrom).toLocaleDateString()}
                      </Typography>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div className="flex justify-center mt-4">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 mx-2 bg-[#004D40] text-white rounded-lg"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-gray-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 mx-2 bg-[#004D40] text-white rounded-lg"
          >
            Next
          </button>
        </div>
      </CardBody>
    </Card>
  );
};

// Define PropTypes for the component
OrderDetailPage.propTypes = {
  newOrderData: PropTypes.arrayOf(
    PropTypes.shape({
      customerID: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      company: PropTypes.string.isRequired,
      item: PropTypes.string.isRequired,
      weight: PropTypes.string.isRequired,
      quantity: PropTypes.number.isRequired,
      amount: PropTypes.string.isRequired,
      date: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default OrderDetailPage;
