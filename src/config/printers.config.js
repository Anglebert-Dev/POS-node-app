module.exports = {
    'printer1': {
        name: 'Reception Printer',
        connection_type: 'network',
        ip: process.env.PRINTER1_IP 
    },
    'printer2': {
        name: 'Office Printer',
        connection_type: 'network',
        ip: process.env.PRINTER2_IP 
    }
};