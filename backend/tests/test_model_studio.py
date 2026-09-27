import pytest
import pandas as pd
from app.services.relationship_finder import RelationshipFinder

def test_relationship_finder_cross_dataset():
    df_customers = pd.DataFrame({
        "customer_id": [101, 102, 103, 104, 105],
        "name": ["Alice", "Bob", "Charlie", "David", "Eve"],
        "city": ["New York", "London", "Tokyo", "Paris", "Berlin"]
    })

    df_orders = pd.DataFrame({
        "order_id": [1, 2, 3, 4, 5, 6],
        "customer_id": [101, 101, 102, 103, 104, 105],
        "amount": [250.0, 150.0, 80.0, 320.0, 110.0, 450.0]
    })

    df_support_tickets = pd.DataFrame({
        "ticket_id": ["T1", "T2", "T3"],
        "customer_id": ["101", "102", "103"],
        "issue": ["Login failure", "Billing error", "Delayed delivery"]
    })

    dataframes = {
        "customers": df_customers,
        "orders": df_orders,
        "support_tickets": df_support_tickets
    }

    rels = RelationshipFinder.detect_relationships(dataframes)
    assert len(rels) >= 2, f"Expected at least 2 relationships, got {len(rels)}"

    # Check customers <-> orders
    cust_orders = [
        r for r in rels
        if (r["source_table"] == "customers" and r["target_table"] == "orders") or
           (r["source_table"] == "orders" and r["target_table"] == "customers")
    ]
    assert len(cust_orders) == 1
    assert cust_orders[0]["source_column"] == "customer_id"
    assert cust_orders[0]["target_column"] == "customer_id"

    # Check cross-type (int vs string customer_id) customers <-> support_tickets
    cust_tickets = [
        r for r in rels
        if (r["source_table"] == "customers" and r["target_table"] == "support_tickets") or
           (r["source_table"] == "support_tickets" and r["target_table"] == "customers")
    ]
    assert len(cust_tickets) == 1
