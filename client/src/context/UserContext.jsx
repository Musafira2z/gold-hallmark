import { createContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
export const UserContext = createContext();
const UserContextProvider = ({ children }) => {
    const [customers, setCustomers] = useState([]);
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const response = await fetch('http://localhost:8003/users');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setCustomers(data);
            } catch (error) {
                console.error('Error fetching customers:', error);
            }
        };
        fetchCustomers();
    }, []);
    const [userCustomers, setUserCustomers] = useState([]);
    useEffect(() => {
        const fetchCustomers = async () => {
            try {
                const response = await fetch('http://localhost:8003/getLastCustomerID');
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                const data = await response.json();
                setUserCustomers(data);
            } catch (error) {
                console.error('Error fetching customers:', error);
            }
        };
        fetchCustomers();
    }, []);

    const value = {
        customers,
        setCustomers,
        userCustomers,
        setUserCustomers
    }
    return (
        <UserContext.Provider value={value}>
            {children}
        </UserContext.Provider>
    )
}
// Define prop types
UserContextProvider.propTypes = {
    children: PropTypes.node.isRequired, // Validate that children is a React node and required
};
export default UserContextProvider;