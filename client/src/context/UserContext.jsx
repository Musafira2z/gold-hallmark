import {createContext, useEffect, useState} from "react";
import PropTypes from "prop-types";

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext();

// Get the base URL from the environment variable
// eslint-disable-next-line no-undef,react-refresh/only-export-components
export const apiUrl = import.meta.env.REACT_APP_API_URL || 'http://localhost:5000'; // Fallback to localhost if not defined

const UserContextProvider = ({children}) => {
    const [customers, setCustomers] = useState([]);
    const [userCustomers, setUserCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch customers and last customer ID in parallel
                const [customersResponse, lastCustomerIDResponse] = await Promise.all([
                    fetch(`${apiUrl}/users`),
                    fetch(`${apiUrl}/users/lastCustomerID`)
                ]);

                if (!customersResponse.ok || !lastCustomerIDResponse.ok) {
                    throw new Error('Network response was not ok');
                }

                const customersData = await customersResponse.json();
                const lastCustomerIDData = await lastCustomerIDResponse.json();

                setCustomers(customersData);
                setUserCustomers(lastCustomerIDData);
            } catch (error) {
                setError(error.message);
                console.error('Error fetching customers:', error);
            } finally {
                setLoading(false); // Stop loading after data fetch attempt
            }
        };

        fetchData();
    }, [apiUrl]); // Add apiUrl as dependency if it changes

    const value = {
        customers,
        setCustomers,
        userCustomers,
        setUserCustomers,
        loading,
        error
    };

    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    );
};

// Define prop types
UserContextProvider.propTypes = {
    children: PropTypes.node.isRequired, // Validate that children is a React node and required
};

export default UserContextProvider;
