require "net/http"
require "uri"
require "json"

namespace :deepgram do
  desc "Check Deepgram API key and connectivity with a silent test audio request"
  task check: :environment do
    # ── 1. Check API key ────────────────────────────────────────────────────
    api_key = ENV["DEEPGRAM_API_KEY"].presence

    if api_key.nil?
      puts "✗ DEEPGRAM_API_KEY is not set in .env"
      exit 1
    end

    puts "✓ DEEPGRAM_API_KEY is set (#{api_key.first(8)}...)"

    # ── 2. Build a minimal silent WAV (0.5 s, 8 kHz, mono, 8-bit PCM) ──────
    sample_rate    = 8_000
    num_samples    = 4_000   # 0.5 s
    data_size      = num_samples
    byte_rate      = sample_rate

    header = [
      "RIFF", 36 + data_size, "WAVE",
      "fmt ", 16,
      1,             # PCM
      1,             # mono
      sample_rate,
      byte_rate,
      1,             # block align
      8,             # bits per sample
      "data", data_size
    ].pack("A4VA4A4VvvVVvvA4V")

    # 0x80 = silence for unsigned 8-bit PCM; force binary encoding on both parts
    silent_wav = header.b + ("\x80".b * data_size)

    # ── 3. Send test request ─────────────────────────────────────────────────
    url = URI("https://api.deepgram.com/v1/listen?model=nova-3&words=true")

    puts "→ Sending test request to Deepgram..."

    begin
      http = Net::HTTP.new(url.host, url.port)
      http.use_ssl = true
      http.open_timeout = 10
      http.read_timeout = 30

      request = Net::HTTP::Post.new(url)
      request["Authorization"] = "Token #{api_key}"
      request["Content-Type"]  = "audio/wav"
      request.body = silent_wav

      response = http.request(request)
      body = JSON.parse(response.body)

      if body["error"]
        puts "✗ Deepgram returned an error: #{body["err_msg"]} (code: #{body["err_code"]})"
        exit 1
      end

      transcript = body.dig("results", "channels", 0, "alternatives", 0, "transcript").to_s
      puts "✓ Request successful (HTTP #{response.code})"
      puts "  Transcript: #{transcript.empty? ? "(empty — expected for silence)" : transcript}"
    rescue => e
      puts "✗ Request failed: #{e.message}"
      exit 1
    end
  end
end
