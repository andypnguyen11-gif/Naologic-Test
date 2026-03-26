CREATE DATABASE NaologicDb;
GO

USE NaologicDb;
GO

CREATE TABLE WorkCenters (
    WorkCenterId NVARCHAR(50) NOT NULL PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL
);
GO

CREATE TABLE WorkOrders (
    WorkOrderId NVARCHAR(50) NOT NULL PRIMARY KEY,
    Name NVARCHAR(200) NOT NULL,
    WorkCenterId NVARCHAR(50) NOT NULL,
    Status NVARCHAR(50) NOT NULL,
    StartDate DATE NOT NULL,
    EndDate DATE NOT NULL,
    CONSTRAINT FK_WorkOrders_WorkCenters
        FOREIGN KEY (WorkCenterId) REFERENCES WorkCenters(WorkCenterId),
    CONSTRAINT CK_WorkOrders_Status
        CHECK (Status IN ('open', 'in-progress', 'complete', 'blocked'))
);
GO

INSERT INTO WorkCenters (WorkCenterId, Name)
VALUES
('wc-001', 'Extrusion Line A'),
('wc-002', 'CNC Machine 1'),
('wc-003', 'Assembly Station'),
('wc-004', 'Quality Control'),
('wc-005', 'Packaging Line');
GO

INSERT INTO WorkOrders (WorkOrderId, Name, WorkCenterId, Status, StartDate, EndDate)
VALUES
('wo-001', 'Extrude 6mm Sheet', 'wc-001', 'complete', '2025-08-05', '2025-10-18'),
('wo-002', 'Extrude 12mm Sheet', 'wc-001', 'in-progress', '2025-11-02', '2026-01-24'),
('wo-003', 'CNC Bracket Run', 'wc-002', 'open', '2026-01-06', '2026-02-22'),
('wo-004', 'CNC Housing Batch', 'wc-002', 'blocked', '2026-03-03', '2026-04-28'),
('wo-005', 'Final Assembly A', 'wc-003', 'open', '2025-12-10', '2026-02-05'),
('wo-006', 'QC Incoming Lot', 'wc-004', 'in-progress', '2025-11-20', '2026-01-12'),
('wo-007', 'QC Final Inspection', 'wc-004', 'blocked', '2026-02-03', '2026-03-18'),
('wo-008', 'Pack Batch 71', 'wc-005', 'complete', '2025-09-14', '2025-11-08');
GO
