import { useContext } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import CustomerInfoForm from "../components/CustomerInfoForm";
import { CustomerDetailTable } from "../components/CustomerDetailTable";
import { UserContext } from "../context/UserContext.jsx";
import { Button, PageHeader } from "../components/ui/index.jsx";

// Customer list with search. "New customer" opens the add form above the list;
// after saving, staff land on the new customer's page, ready to take an order.
function Customers() {
    const { customers, setCustomers } = useContext(UserContext);
    const [params, setParams] = useSearchParams();
    const navigate = useNavigate();
    const showForm = params.get("new") === "1";

    const setShowForm = (show) => setParams(show ? { new: "1" } : {}, { replace: true });

    const onAddCustomer = (newCustomer) => {
        setCustomers((prev) => [...prev, newCustomer]);
        toast.success(`Customer #${newCustomer.customerID} ${newCustomer.name} added`);
        navigate(`/customers/${newCustomer.customerID}`);
    };

    const removeCustomer = (id) => {
        setCustomers((prev) => prev.filter((customer) => customer._id !== id));
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title="Customers"
                subtitle={`${customers.length.toLocaleString("en-IN")} customers. Click a name to see their orders.`}
                actions={
                    showForm ? (
                        <Button variant="secondary" onClick={() => setShowForm(false)}>
                            Close form
                        </Button>
                    ) : (
                        <Button onClick={() => setShowForm(true)}>+ New customer</Button>
                    )
                }
            />
            {showForm && <CustomerInfoForm customers={customers} onAddCustomer={onAddCustomer} />}
            <CustomerDetailTable customers={customers} onRemoveCustomer={removeCustomer} />
        </div>
    );
}

export default Customers;
