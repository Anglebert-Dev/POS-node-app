class PrintJob{
    constructor(content){
        const data = JSON.parse(content);

        this.bussinessId = data.bussinessId;
        this.printerId = data.printerId;
        this.pdfContent = data.pdfContent;
        this.metadata = data.metadata;

        if(!this.bussinessId || !this.printerId || !this.pdfContent || !this.metadata){
            throw new Error('Print Job missing required fields');
        }
    }

    getPDFBuffer(){
        return Buffer.from(this.pdfContent, 'base64');
    }
}

module.exports = PrintJob;