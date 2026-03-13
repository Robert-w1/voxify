class GenerateReportPdfJob < ApplicationJob
  queue_as :default

  def perform(report_id)
    report    = Report.find(report_id)
    recording = report.recording
    session   = recording.recording_session

    pdf_binary = PdfReportService.new(session, recording, report).generate

    report.pdf_file.attach(
      io:           StringIO.new(pdf_binary),
      filename:     "voxify-report-#{report.id}.pdf",
      content_type: "application/pdf"
    )
  end
end
