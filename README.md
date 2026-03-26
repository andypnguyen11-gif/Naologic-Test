This project is a full-stack manufacturing scheduling app for managing work
  orders across work centers.

  It includes:

  - an Angular frontend that displays work orders in a timeline/grid view
  - a C# ASP.NET Core API for retrieving and managing work-center and work-order
    data
  - a SQL Server database for persisting the data shown in the UI

  The frontend allows users to:

  - view work orders by day, week, or month
  - create, edit, and delete work orders
  - see work orders grouped by work center
  - validate scheduling conflicts in the UI

  The backend is responsible for:

  - serving work-center and work-order data to the frontend
  - handling create, update, and delete operations
  - persisting application data in SQL Server instead of browser localStorage

  The database layer includes:

  - a WorkCenters table
  - a WorkOrders table
  - a SQL setup and seed script that creates the schema and loads the initial
    sample data
