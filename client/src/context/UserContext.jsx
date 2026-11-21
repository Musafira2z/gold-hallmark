import {createContext, useEffect, useState} from "react";
import axios from "axios";
import PropTypes from "prop-types";

// eslint-disable-next-line react-refresh/only-export-components
export const UserContext = createContext();

const resolveApiUrl = () => {
    const envUrl = (import.meta.env.VITE_API_URL || import.meta.env.REACT_APP_API_URL || "").trim();
    const hasCustomEnv = envUrl.length > 0;

    // When the env points to the docker-internal host (e.g. http://server:5000) the browser cannot resolve it.
    if (hasCustomEnv && !envUrl.includes("://server")) {
        return envUrl.replace(/\/$/, "");
    }

    if (typeof window !== "undefined") {
        const { protocol, hostname } = window.location;
        const defaultPort = import.meta.env.VITE_API_PORT || 5000;
        return `${protocol}//${hostname}:${defaultPort}`;
    }

    return "http://localhost:5000";
};

// eslint-disable-next-line react-refresh/only-export-components
export const apiUrl = resolveApiUrl();

const UserContextProvider = ({children}) => {
    const [customers, setCustomers] = useState([]);
    const [userCustomers, setUserCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // axios, so the login token goes with the request (see AuthContext)
                const [customersResponse, lastCustomerIDResponse] = await Promise.all([
                    axios.get(`${apiUrl}/users`),
                    axios.get(`${apiUrl}/users/lastCustomerID`)
                ]);

                const customersData = customersResponse.data;
                const lastCustomerIDData = lastCustomerIDResponse.data;

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
