from job_leads_tool.connectors import _parse_rss_items


def test_parse_rss_items_reads_namespaced_dc_date():
    text = """
    <rss xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel>
        <item>
          <title>Data Analyst at Example Co</title>
          <link>https://example.com/jobs/1</link>
          <dc:date>2026-06-03T12:00:00Z</dc:date>
          <description>Build dashboards.</description>
        </item>
      </channel>
    </rss>
    """

    rows = _parse_rss_items("memory", text)

    assert rows[0]["posted_at"] == "2026-06-03T12:00:00Z"
